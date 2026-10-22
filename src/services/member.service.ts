import { pool } from '../config/db';
import { ApplicationStatus } from '../types';
import { AuditService } from './audit.service';

export interface ApplicationInput {
  fullName: string;
  email: string;
  phone: string;
  preferredBranchId?: string;
  notes?: string;
}

export class MemberService {
  /**
   * Public submission of a volunteer application
   */
  static async submitApplication(input: ApplicationInput, ipAddress?: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO volunteer_applications (full_name, email, phone, preferred_branch_id, notes, status)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const res = await client.query(insertQuery, [
        input.fullName.trim(),
        input.email.toLowerCase().trim(),
        input.phone.trim(),
        input.preferredBranchId || null,
        input.notes || null,
        ApplicationStatus.APPLIED,
      ]);

      const application = res.rows[0];

      await AuditService.log(client, {
        actor_id: null,
        action: 'APPLICATION_SUBMITTED',
        entity_type: 'VOLUNTEER_APPLICATION',
        record_id: application.id,
        before_state: null,
        after_state: application,
        ip_address: ipAddress,
      });

      await client.query('COMMIT');
      return application;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Reviews an application. When status changes to ACCEPTED, automatically converts to a Member.
   */
  static async reviewApplication(
    applicationId: string,
    status: ApplicationStatus,
    reviewerId: string,
    assignedBranchId?: string,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM volunteer_applications WHERE id = $1 FOR UPDATE',
        [applicationId]
      );

      if (selectRes.rows.length === 0) {
        throw new Error('Application not found');
      }

      const current = selectRes.rows[0];

      if (current.status !== ApplicationStatus.APPLIED) {
        throw new Error(`Application has already been resolved as ${current.status}`);
      }

      const updateRes = await client.query(
        `UPDATE volunteer_applications 
         SET status = $1, reviewed_by = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3 RETURNING *`,
        [status, reviewerId, applicationId]
      );
      const updatedApp = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: reviewerId,
        action: 'APPLICATION_REVIEWED',
        entity_type: 'VOLUNTEER_APPLICATION',
        record_id: applicationId,
        before_state: current,
        after_state: updatedApp,
        ip_address: ipAddress,
      });

      let createdMember = null;

      // When accepted, atomically generate the Member record with a sequenced ID
      if (status === ApplicationStatus.ACCEPTED) {
        const branchId = assignedBranchId || current.preferred_branch_id;
        if (!branchId) {
          throw new Error('A branch assignment is required to accept a volunteer as a member');
        }

        const seqRes = await client.query("SELECT nextval('member_id_seq') AS num");
        const memberCode = `MEM-${seqRes.rows[0].num}`;

        const insertMemberQuery = `
          INSERT INTO members (
            member_code, application_id, branch_id, full_name, email, phone, status
          ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
          RETURNING *
        `;

        const memberRes = await client.query(insertMemberQuery, [
          memberCode,
          applicationId,
          branchId,
          current.full_name,
          current.email,
          current.phone,
        ]);
        createdMember = memberRes.rows[0];

        await AuditService.log(client, {
          actor_id: reviewerId,
          action: 'MEMBER_CONVERTED',
          entity_type: 'MEMBER',
          record_id: createdMember.id,
          before_state: null,
          after_state: createdMember,
          ip_address: ipAddress,
        });
      }

      await client.query('COMMIT');
      return { application: updatedApp, member: createdMember };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Search and filter members across branches
   */
  static async listMembers(filters: { branchId?: string; search?: string }) {
    let query = `
      SELECT m.*, b.name as branch_name 
      FROM members m 
      JOIN branches b ON m.branch_id = b.id 
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.branchId) {
      params.push(filters.branchId);
      query += ` AND m.branch_id = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search.toLowerCase()}%`);
      query += ` AND (LOWER(m.full_name) LIKE $${params.length} OR LOWER(m.email) LIKE $${params.length} OR LOWER(m.member_code) LIKE $${params.length})`;
    }

    query += ' ORDER BY m.created_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }
}