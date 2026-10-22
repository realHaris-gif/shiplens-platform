import { pool } from '../config/db';
import { BranchStatus, Role } from '../types';
import { AuditService } from './audit.service';

export interface CreateBranchInput {
  name: string;
  city: string;
}

export class BranchService {
  /**
   * Generates the next sequential branch code (e.g., BR-100, BR-101)
   */
  static async getNextBranchCode(client: any): Promise<string> {
    const res = await client.query("SELECT nextval('branch_code_seq') AS num");
    return `BR-${res.rows[0].num}`;
  }

  /**
   * Creates a new branch in FORMING state and logs the action
   */
  static async createBranch(input: CreateBranchInput, actorId: string, ipAddress?: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const code = await this.getNextBranchCode(client);

      const insertQuery = `
        INSERT INTO branches (code, name, city, status)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const res = await client.query(insertQuery, [
        code,
        input.name.trim(),
        input.city.trim(),
        BranchStatus.FORMING,
      ]);

      const branch = res.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'BRANCH_CREATED',
        entity_type: 'BRANCH',
        record_id: branch.id,
        before_state: null,
        after_state: branch,
        ip_address: ipAddress,
      });

      await client.query('COMMIT');
      return branch;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Updates branch status strictly validating lifecycle transitions
   */
  static async updateBranchStatus(
    branchId: string,
    newStatus: BranchStatus,
    actorId: string,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM branches WHERE id = $1 FOR UPDATE',
        [branchId]
      );

      if (selectRes.rows.length === 0) {
        throw new Error('Branch not found');
      }

      const current = selectRes.rows[0];
      const currentStatus: BranchStatus = current.status;

      // Rule 1: Terminal CLOSED check
      if (currentStatus === BranchStatus.CLOSED) {
        throw new Error('A closed branch cannot be reopened or transitioned to any other state');
      }

      // Rule 2: Cannot activate without an assigned Branch Lead
      if (newStatus === BranchStatus.ACTIVE && currentStatus !== BranchStatus.ACTIVE) {
        const leadRes = await client.query(
          'SELECT id FROM users WHERE branch_id = $1 AND role = $2 AND is_active = true',
          [branchId, Role.BRANCH_LEAD]
        );
        if (leadRes.rows.length === 0) {
          throw new Error('Cannot activate branch without an assigned active BRANCH_LEAD');
        }
      }

      const updateRes = await client.query(
        'UPDATE branches SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [newStatus, branchId]
      );

      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'BRANCH_STATUS_UPDATED',
        entity_type: 'BRANCH',
        record_id: branchId,
        before_state: current,
        after_state: updated,
        ip_address: ipAddress,
      });

      await client.query('COMMIT');
      return updated;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async listBranches() {
    const res = await pool.query('SELECT * FROM branches ORDER BY created_at DESC');
    return res.rows;
  }
}