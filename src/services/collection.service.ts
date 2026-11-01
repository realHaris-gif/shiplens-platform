import { pool } from '../config/db';
import { AuditService } from './audit.service';

export interface CreateCollectionInput {
  branchId: string;
  amountPaisa: number;
  collectionDate: string; // YYYY-MM-DD
}

export interface UpdateCollectionInput {
  amountPaisa?: number;
  collectionDate?: string;
}

export class CollectionService {
  /**
   * Records a daily physical collection. Validates positive integer paisa and past/present date.
   */
  static async recordCollection(
    input: CreateCollectionInput,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string
  ) {
    if (!Number.isInteger(input.amountPaisa) || input.amountPaisa <= 0) {
      throw new Error('Amount must be a positive integer representing paisa (1 PKR = 100 paisa)');
    }

    // P0-03: Scope verification inside the service
    if (actorBranchScope && input.branchId !== actorBranchScope) {
      throw new Error('Cannot record collection for a foreign branch');
    }

    // VAL-2: Date format and future date validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.collectionDate)) {
      throw new Error('Collection date must be in YYYY-MM-DD format');
    }
    const colDate = new Date(`${input.collectionDate}T00:00:00Z`);
    if (isNaN(colDate.getTime())) {
      throw new Error('Invalid collection date');
    }
    const today = new Date();
    today.setUTCHours(23, 59, 59, 999);
    if (colDate > today) {
      throw new Error('Collection date cannot be in the future');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify branch exists and is active
      const branchRes = await client.query(
        'SELECT status FROM branches WHERE id = $1',
        [input.branchId]
      );
      if (branchRes.rows.length === 0) {
        throw new Error('Branch not found');
      }
      if (branchRes.rows[0].status !== 'ACTIVE') {
        throw new Error('Collections can only be logged for ACTIVE branches');
      }

      // P0-13: Reject collection if dated inside an already SUBMITTED or APPROVED report week
      const conflictReportRes = await client.query(
        `SELECT id, status FROM weekly_reports 
         WHERE branch_id = $1 
           AND week_start_date <= $2 
           AND week_end_date >= $2 
           AND status IN ('SUBMITTED', 'RESUBMITTED', 'APPROVED')`,
        [input.branchId, input.collectionDate]
      );
      if (conflictReportRes.rows.length > 0) {
        throw new Error(
          `Cannot log collections for a period covered by a ${conflictReportRes.rows[0].status} weekly report`
        );
      }

      const insertQuery = `
        INSERT INTO collections (branch_id, collected_by, amount_paisa, collection_date)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      const res = await client.query(insertQuery, [
        input.branchId,
        actorId,
        input.amountPaisa,
        input.collectionDate,
      ]);

      const collection = res.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'COLLECTION_RECORDED',
        entity_type: 'COLLECTION',
        record_id: collection.id,
        before_state: null,
        after_state: collection,
        ip_address: ipAddress || null,
      });

      await client.query('COMMIT');
      return collection;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Updates an existing collection record subject to branch scoping and the 7-day rule.
   */
  static async updateCollection(
    collectionId: string,
    input: UpdateCollectionInput,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string,
    currentTimestampMs: number = Date.now() // COL-1: Controllable clock for unit tests
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM collections WHERE id = $1 FOR UPDATE',
        [collectionId]
      );

      if (selectRes.rows.length === 0) {
        throw new Error('Collection not found');
      }

      const current = selectRes.rows[0];

      // P0-03: Scope verification (hide record existence from other branches)
      if (actorBranchScope && current.branch_id !== actorBranchScope) {
        throw new Error('Collection not found');
      }

      // Explicit lock check
      if (current.is_locked) {
        throw new Error('Cannot edit a locked collection record');
      }

      // COL-1: 7-Day immutability window check with controllable clock
      const createdAt = new Date(current.created_at).getTime();
      const diffInDays = (currentTimestampMs - createdAt) / (1000 * 60 * 60 * 24);

      if (diffInDays > 7) {
        // Persist the lock
        await client.query('UPDATE collections SET is_locked = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1', [collectionId]);
        await client.query('COMMIT');
        throw new Error('Collection record is older than 7 days and is permanently locked against modifications');
      }

      const amountPaisa = input.amountPaisa ?? current.amount_paisa;
      const collectionDate = input.collectionDate ?? current.collection_date;

      if (!Number.isInteger(Number(amountPaisa)) || Number(amountPaisa) <= 0) {
        throw new Error('Amount must be a positive integer representing paisa');
      }

      if (input.collectionDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(input.collectionDate)) {
          throw new Error('Collection date must be in YYYY-MM-DD format');
        }
        const colDate = new Date(`${input.collectionDate}T00:00:00Z`);
        const today = new Date();
        today.setUTCHours(23, 59, 59, 999);
        if (colDate > today) {
          throw new Error('Collection date cannot be in the future');
        }
      }

      // P0-13: Reject update if date falls under an already SUBMITTED or APPROVED report
      const conflictReportRes = await client.query(
        `SELECT id, status FROM weekly_reports 
         WHERE branch_id = $1 
           AND week_start_date <= $2 
           AND week_end_date >= $2 
           AND status IN ('SUBMITTED', 'RESUBMITTED', 'APPROVED')`,
        [current.branch_id, collectionDate]
      );
      if (conflictReportRes.rows.length > 0) {
        throw new Error(
          `Cannot update collection into a period covered by a ${conflictReportRes.rows[0].status} weekly report`
        );
      }

      const updateRes = await client.query(
        `UPDATE collections
         SET amount_paisa = $1, collection_date = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING *`,
        [amountPaisa, collectionDate, collectionId]
      );
      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'COLLECTION_UPDATED',
        entity_type: 'COLLECTION',
        record_id: collectionId,
        before_state: current,
        after_state: updated,
        ip_address: ipAddress || null,
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

  static async lockCollection(
    collectionId: string,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM collections WHERE id = $1 FOR UPDATE',
        [collectionId]
      );

      if (selectRes.rows.length === 0) {
        throw new Error('Collection not found');
      }

      const current = selectRes.rows[0];
      if (actorBranchScope && current.branch_id !== actorBranchScope) {
        throw new Error('Collection not found');
      }

      if (current.is_locked) {
        throw new Error('Collection is already locked');
      }

      const updateRes = await client.query(
        `UPDATE collections 
         SET is_locked = true, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 RETURNING *`,
        [collectionId]
      );
      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'COLLECTION_LOCKED',
        entity_type: 'COLLECTION',
        record_id: collectionId,
        before_state: current,
        after_state: updated,
        ip_address: ipAddress || null,
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

  static async markTransferred(
    collectionId: string,
    actorId: string,
    actorBranchScope: string | null = null,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query(
        'SELECT * FROM collections WHERE id = $1 FOR UPDATE',
        [collectionId]
      );

      if (selectRes.rows.length === 0) {
        throw new Error('Collection not found');
      }

      const current = selectRes.rows[0];
      if (actorBranchScope && current.branch_id !== actorBranchScope) {
        throw new Error('Collection not found');
      }

      // VAL-2: Idempotency check
      if (current.is_sent_to_main_account) {
        throw new Error('Collection has already been transferred to the central account');
      }

      const updateRes = await client.query(
        `UPDATE collections 
         SET is_sent_to_main_account = true, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 RETURNING *`,
        [collectionId]
      );
      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'COLLECTION_TRANSFERRED',
        entity_type: 'COLLECTION',
        record_id: collectionId,
        before_state: current,
        after_state: updated,
        ip_address: ipAddress || null,
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

  static async listCollections(branchId?: string | null) {
    let query = `
      SELECT c.*, b.name AS branch_name, b.code AS branch_code
      FROM collections c
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (branchId) {
      params.push(branchId);
      query += ` AND c.branch_id = $${params.length}`;
    }

    query += ' ORDER BY c.collection_date DESC, c.created_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  static async listUnroutedCollections(branchId?: string | null) {
    let query = `
      SELECT c.*, b.name AS branch_name, b.code AS branch_code
      FROM collections c
      LEFT JOIN branches b ON c.branch_id = b.id
      WHERE c.is_sent_to_main_account = false
    `;
    const params: any[] = [];

    if (branchId) {
      params.push(branchId);
      query += ` AND c.branch_id = $${params.length}`;
    }

    query += ' ORDER BY c.collection_date ASC';
    const res = await pool.query(query, params);
    return res.rows;
  }
}