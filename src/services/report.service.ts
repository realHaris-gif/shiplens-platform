import { pool } from '../config/db';
import { WeeklyReportStatus, Role } from '../types';
import { AuditService } from './audit.service';

export interface CreateReportInput {
  branchId: string;
  weekStartDate: string; // YYYY-MM-DD (Monday)
  weekEndDate: string;   // YYYY-MM-DD (Sunday)
  submissionNotes?: string;
}

export class ReportService {
  /**
   * Drafts a new weekly branch report
   */
  static async createDraft(
    input: CreateReportInput,
    actorId: string,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify branch exists and is active
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

      // 2. Sum collections for this branch during this week
      const sumRes = await client.query(
        `SELECT COALESCE(SUM(amount_paisa), 0) AS total 
         FROM collections 
         WHERE branch_id = $1 
           AND collection_date >= $2 
           AND collection_date <= $3`,
        [input.branchId, input.weekStartDate, input.weekEndDate]
      );
      const totalAmountPaisa = BigInt(sumRes.rows[0].total);

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
        totalAmountPaisa.toString(),
        input.submissionNotes || null,
        actorId,
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
   * Submits a draft report for HQ review
   */
  static async submitReport(
    reportId: string,
    actorId: string,
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
      if (
        current.status !== WeeklyReportStatus.DRAFT &&
        current.status !== WeeklyReportStatus.RETURNED
      ) {
        throw new Error(`Cannot submit report in status ${current.status}`);
      }

      const nextStatus =
        current.status === WeeklyReportStatus.RETURNED
          ? WeeklyReportStatus.RESUBMITTED
          : WeeklyReportStatus.SUBMITTED;

      const updateRes = await client.query(
        `UPDATE weekly_reports 
         SET status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 RETURNING *`,
        [nextStatus, reportId]
      );
      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'REPORT_SUBMITTED',
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
   * Approves report, freezes metrics snapshot in JSONB, and locks associated collections
   */
  static async approveReport(
    reportId: string,
    actorId: string,
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
      if (
        current.status !== WeeklyReportStatus.SUBMITTED &&
        current.status !== WeeklyReportStatus.RESUBMITTED
      ) {
        throw new Error(`Cannot approve report in status ${current.status}`);
      }

      // Roll up active members for this branch
      const memberCountRes = await client.query(
        "SELECT COUNT(*)::int AS count FROM members WHERE branch_id = $1 AND status = 'ACTIVE'",
        [current.branch_id]
      );
      const activeMembersCount = memberCountRes.rows[0].count;

      // Roll up collection count and details
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
        totalAmountPaisa: current.total_amount_paisa,
        collectionsCount: collectionsRes.rows.length,
        activeMembersSnapshot: activeMembersCount,
        collectionRecords: collectionsRes.rows.map((r: any) => ({
          id: r.id,
          amountPaisa: r.amount_paisa,
          date: r.collection_date,
        })),
      };

      // Lock all associated collections
      await client.query(
        `UPDATE collections 
         SET is_locked = true, updated_at = CURRENT_TIMESTAMP 
         WHERE branch_id = $1 
           AND collection_date >= $2 
           AND collection_date <= $3`,
        [current.branch_id, current.week_start_date, current.week_end_date]
      );

      // Transition report to APPROVED with frozen metrics
      const updateRes = await client.query(
        `UPDATE weekly_reports 
         SET status = $1, approved_by = $2, frozen_metrics = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 RETURNING *`,
        [WeeklyReportStatus.APPROVED, actorId, JSON.stringify(frozenMetrics), reportId]
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

  static async listReports(filters: { branchId?: string; status?: string }) {
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