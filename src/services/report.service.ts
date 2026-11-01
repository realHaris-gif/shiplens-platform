import { pool } from '../config/db';
import { WeeklyReportStatus } from '../types';
import { AuditService } from './audit.service';

export interface CreateReportInput {
  branchId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  submissionNotes?: string;
}

export class ReportService {
  /**
   * Helper to recalculate actual collections sum inside a locked transaction
   */
  private static async computeCollectionsTotal(
    client: any,
    branchId: string,
    startDate: string,
    endDate: string
  ): Promise<string> {
    const sumRes = await client.query(
      `SELECT COALESCE(SUM(amount_paisa), 0) AS total 
       FROM collections 
       WHERE branch_id = $1 
         AND collection_date >= $2 
         AND collection_date <= $3`,
      [branchId, startDate, endDate]
    );
    return sumRes.rows[0].total.toString();
  }

  /**
   * Drafts a new weekly branch report with strict Monday-to-Sunday checking
   */
  static async createDraft(
    input: CreateReportInput,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string
  ) {
    if (!input.weekStartDate || !input.weekEndDate) {
      throw new Error('Both weekStartDate and weekEndDate are required');
    }

    if (actorBranchScope && input.branchId !== actorBranchScope) {
      throw new Error('Cannot create report for another branch');
    }

    // P0-14: Server-enforced Monday-to-Sunday ISO week boundaries
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(input.weekStartDate) || !datePattern.test(input.weekEndDate)) {
      throw new Error('Dates must be in YYYY-MM-DD format');
    }

    const startDate = new Date(`${input.weekStartDate}T00:00:00Z`);
    const endDate = new Date(`${input.weekEndDate}T00:00:00Z`);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid date format for weekStartDate or weekEndDate');
    }

    // Day of week check: getUTCDay() === 1 is Monday
    if (startDate.getUTCDay() !== 1) {
      throw new Error('weekStartDate must fall on a Monday');
    }

    // Exact 6-day span (Monday to Sunday)
    const diffDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays !== 6) {
      throw new Error('A weekly report period must span exactly 7 days (Monday to Sunday)');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const branchRes = await client.query(
        'SELECT status FROM branches WHERE id = $1',
        [input.branchId]
      );
      if (branchRes.rows.length === 0) {
        throw new Error('Branch not found');
      }
      if (branchRes.rows[0].status !== 'ACTIVE') {
        throw new Error('Reports can only be created for ACTIVE branches');
      }

      // Compute initial sum from database
      const totalAmountPaisa = await this.computeCollectionsTotal(
        client,
        input.branchId,
        input.weekStartDate,
        input.weekEndDate
      );

      const insertQuery = `
        INSERT INTO weekly_reports (
          branch_id, week_start_date, week_end_date, status, 
          total_amount_paisa, submission_notes, submitted_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const res = await client.query(insertQuery, [
        input.branchId,
        input.weekStartDate,
        input.weekEndDate,
        WeeklyReportStatus.DRAFT,
        totalAmountPaisa,
        input.submissionNotes || null,
        null, // submitted_by is formally assigned on submission
      ]);

      const report = res.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'REPORT_DRAFT_CREATED',
        entity_type: 'WEEKLY_REPORT',
        record_id: report.id,
        before_state: null,
        after_state: report,
        ip_address: ipAddress,
      });

      await client.query('COMMIT');
      return report;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Submits or resubmits a report for HQ review.
   * Recalculates total_amount_paisa inside transaction and logs proper action.
   */
  static async submitReport(
    reportId: string,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM weekly_reports WHERE id = $1 FOR UPDATE',
        [reportId]
      );
      if (selectRes.rows.length === 0) {
        throw new Error('Report not found');
      }

      const current = selectRes.rows[0];

      // P0-03: Scope check
      if (actorBranchScope && current.branch_id !== actorBranchScope) {
        throw new Error('Report not found');
      }

      if (
        current.status !== WeeklyReportStatus.DRAFT &&
        current.status !== WeeklyReportStatus.RETURNED
      ) {
        throw new Error(`Cannot submit report in status ${current.status}`);
      }

      const isResubmit = current.status === WeeklyReportStatus.RETURNED;
      const nextStatus = isResubmit
        ? WeeklyReportStatus.RESUBMITTED
        : WeeklyReportStatus.SUBMITTED;

      // P0-13: Recompute collections total dynamically inside the locked transaction
      const freshTotalPaisa = await this.computeCollectionsTotal(
        client,
        current.branch_id,
        current.week_start_date,
        current.week_end_date
      );

      const updateRes = await client.query(
        `UPDATE weekly_reports 
         SET status = $1, 
             total_amount_paisa = $2, 
             submitted_by = $3, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 RETURNING *`,
        [nextStatus, freshTotalPaisa, actorId, reportId]
      );
      const updated = updateRes.rows[0];

      // P0-14: Distinguish submission from resubmission in audit log
      await AuditService.log(client, {
        actor_id: actorId,
        action: isResubmit ? 'REPORT_RESUBMITTED' : 'REPORT_SUBMITTED',
        entity_type: 'WEEKLY_REPORT',
        record_id: reportId,
        before_state: current,
        after_state: updated,
        ip_address: ipAddress,
      });

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Approves report, freezes metrics snapshot in JSONB, and locks associated collections.
   */
  static async approveReport(
    reportId: string,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM weekly_reports WHERE id = $1 FOR UPDATE',
        [reportId]
      );
      if (selectRes.rows.length === 0) {
        throw new Error('Report not found');
      }

      const current = selectRes.rows[0];

      // P0-03: Scope check
      if (actorBranchScope && current.branch_id !== actorBranchScope) {
        throw new Error('Report not found');
      }

      if (
        current.status !== WeeklyReportStatus.SUBMITTED &&
        current.status !== WeeklyReportStatus.RESUBMITTED
      ) {
        throw new Error(`Cannot approve report in status ${current.status}`);
      }

      // P0-13: Recompute the final collections total immediately before freezing
      const finalTotalPaisa = await this.computeCollectionsTotal(
        client,
        current.branch_id,
        current.week_start_date,
        current.week_end_date
      );

      // Roll up active members for this branch
      const memberCountRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM members WHERE branch_id = $1 AND status = 'ACTIVE'",
        [current.branch_id]
      );
      const activeMembersCount = memberCountRes.rows[0].count;

      // Roll up collection details
      const collectionsRes = await client.query(
        `SELECT id, amount_paisa, collection_date 
         FROM collections 
         WHERE branch_id = $1 
           AND collection_date >= $2 
           AND collection_date <= $3`,
        [current.branch_id, current.week_start_date, current.week_end_date]
      );

      // Build frozen metrics snapshot
      const frozenMetrics = {
        approvedAt: new Date().toISOString(),
        approvedBy: actorId,
        totalAmountPaisa: finalTotalPaisa,
        collectionsCount: collectionsRes.rows.length,
        activeMembersSnapshot: activeMembersCount,
        collectionRecords: collectionsRes.rows.map((r: any) => ({
          id: r.id,
          amountPaisa: r.amount_paisa,
          date: r.collection_date,
        })),
      };

      // Lock all collections in this approved week
      await client.query(
        `UPDATE collections 
         SET is_locked = true, updated_at = CURRENT_TIMESTAMP 
         WHERE branch_id = $1 
           AND collection_date >= $2 
           AND collection_date <= $3`,
        [current.branch_id, current.week_start_date, current.week_end_date]
      );

      // P0-14: Transition report to APPROVED with frozen metrics and final recalculated sum
      const updateRes = await client.query(
        `UPDATE weekly_reports 
         SET status = $1, 
             approved_by = $2, 
             total_amount_paisa = $3, 
             frozen_metrics = $4, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $5 RETURNING *`,
        [WeeklyReportStatus.APPROVED, actorId, finalTotalPaisa, JSON.stringify(frozenMetrics), reportId]
      );
      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'REPORT_APPROVED_AND_METRICS_FROZEN',
        entity_type: 'WEEKLY_REPORT',
        record_id: reportId,
        before_state: current,
        after_state: updated,
        ip_address: ipAddress,
      });

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Returns a report to branch lead with rejection notes
   */
  static async returnReport(
    reportId: string,
    rejectionReason: string,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string
  ) {
    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new Error('Rejection reason is required');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM weekly_reports WHERE id = $1 FOR UPDATE',
        [reportId]
      );
      if (selectRes.rows.length === 0) {
        throw new Error('Report not found');
      }

      const current = selectRes.rows[0];
      if (actorBranchScope && current.branch_id !== actorBranchScope) {
        throw new Error('Report not found');
      }

      if (
        current.status !== WeeklyReportStatus.SUBMITTED &&
        current.status !== WeeklyReportStatus.RESUBMITTED
      ) {
        throw new Error(`Cannot return report in status ${current.status}`);
      }

      const updateRes = await client.query(
        `UPDATE weekly_reports 
         SET status = $1, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 RETURNING *`,
        [WeeklyReportStatus.RETURNED, rejectionReason.trim(), reportId]
      );
      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'REPORT_RETURNED',
        entity_type: 'WEEKLY_REPORT',
        record_id: reportId,
        before_state: current,
        after_state: updated,
        ip_address: ipAddress,
      });

      await client.query('COMMIT');
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async listReports(filters: { branchId?: string | null; status?: string }) {
    let query = 'SELECT * FROM weekly_reports WHERE 1=1';
    const params: any[] = [];

    if (filters.branchId) {
      params.push(filters.branchId);
      query += ` AND branch_id = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status);
      query += ` AND status = $${params.length}`;
    }

    query += ' ORDER BY week_start_date DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }
}