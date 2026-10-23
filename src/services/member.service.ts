import { pool } from '../config/db';
import { ApplicationStatus, MemberStatus } from '../types';
import { AuditService } from './audit.service';

export interface ApplyVolunteerInput {
  fullName: string;
  email: string;
  phone: string;
  preferredBranchId?: string;
  notes?: string;
}

export class MemberService {
  /**
   * Submits a volunteer application
   */
  static async apply(
    input: ApplyVolunteerInput,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertQuery = `
        INSERT INTO volunteer_applications (
          full_name, email, phone, preferred_branch_id, notes, status
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const res = await client.query(insertQuery, [
        input.fullName,
        input.email,
        input.phone,
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
        ip_address: ipAddress || null,
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
   * Reviews an application and atomically creates an official member record on acceptance
   */
  static async reviewApplication(
    applicationId: string,
    status: 'ACCEPTED' | 'DECLINED',
    actorId: string,
    assignedBranchId?: string,
    rejectionReason?: string,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectApp = await client.query(
        'SELECT * FROM volunteer_applications WHERE id = $1 FOR UPDATE',
        [applicationId]
      );

      if (selectApp.rows.length === 0) {
        throw new Error('Application not found');
      }

      const app = selectApp.rows[0];

      if (app.status !== ApplicationStatus.APPLIED) {
        throw new Error(`Cannot review an application already in ${app.status} status`);
      }

      const updateAppQuery = `
        UPDATE volunteer_applications 
        SET status = $1, reviewed_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const appUpdateRes = await client.query(updateAppQuery, [
        status,
        actorId,
        applicationId,
      ]);
      const updatedApp = appUpdateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'APPLICATION_REVIEWED',
        entity_type: 'VOLUNTEER_APPLICATION',
        record_id: applicationId,
        before_state: app,
        after_state: updatedApp,
        ip_address: ipAddress || null,
      });

      let memberRecord = null;

      // If accepted, generate sequential code from member_id_seq and insert into members
      if (status === 'ACCEPTED') {
        const branchIdToAssign = assignedBranchId || app.preferred_branch_id;
        if (!branchIdToAssign) {
          throw new Error('A branch must be assigned to accept a volunteer as a member');
        }

        // Schema uses member_id_seq starting from 1000
        const seqRes = await client.query("SELECT nextval('member_id_seq') AS seq");
        const nextSeq = seqRes.rows[0].seq;
        const memberCode = `MEM-${nextSeq}`;

        const insertMemberQuery = `
          INSERT INTO members (
            member_code, application_id, branch_id, full_name, email, phone, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `;

        const memRes = await client.query(insertMemberQuery, [
          memberCode,
          applicationId,
          branchIdToAssign,
          app.full_name,
          app.email,
          app.phone,
          MemberStatus.ACTIVE,
        ]);

        memberRecord = memRes.rows[0];

        await AuditService.log(client, {
          actor_id: actorId,
          action: 'MEMBER_CONVERTED',
          entity_type: 'MEMBER',
          record_id: memberRecord.id,
          before_state: null,
          after_state: memberRecord,
          ip_address: ipAddress || null,
        });
      }

      await client.query('COMMIT');
      return {
        application: updatedApp,
        member: memberRecord,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * List volunteer applications for HR review
   */
  static async listApplications(status?: string) {
    let query = `
      SELECT 
        a.id,
        a.full_name,
        a.email,
        a.phone,
        a.notes,
        a.status,
        a.preferred_branch_id,
        a.created_at,
        b.name AS preferred_branch_name,
        b.code AS preferred_branch_code
      FROM volunteer_applications a
      LEFT JOIN branches b ON a.preferred_branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    query += ' ORDER BY a.created_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  /**
   * List active members with branch metadata
   */
  static async listMembers(branchId?: string) {
    let query = `
      SELECT m.*, b.name AS branch_name, b.code AS branch_code
      FROM members m
      LEFT JOIN branches b ON m.branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (branchId) {
      params.push(branchId);
      query += ` AND m.branch_id = $${params.length}`;
    }

    query += ' ORDER BY m.member_code ASC';
    const res = await pool.query(query, params);
    return res.rows;
  }
}