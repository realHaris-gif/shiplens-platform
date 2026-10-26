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
   * Records a daily physical collection. Strictly validates positive integer paisa.
   */
  static async recordCollection(
    input: CreateCollectionInput,
    actorId: string,
    ipAddress?: string
  ) {
    if (!Number.isInteger(input.amountPaisa) || input.amountPaisa <= 0) {
      throw new Error('Amount must be a positive integer representing paisa (1 PKR = 100 paisa)');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify branch is active
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
   * Updates an existing collection record subject to the 7-day locking rule.
   */
  static async updateCollection(
    collectionId: string,
    input: UpdateCollectionInput,
    actorId: string,
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

      // 1. Explicit lock check
      if (current.is_locked) {
        throw new Error('Cannot edit a locked collection record');
      }

      // 2. 7-Day immutability window check
      const createdAt = new Date(current.created_at).getTime();
      const now = Date.now();
      const diffInDays = (now - createdAt) / (1000 * 60 * 60 * 24);

      if (diffInDays > 7) {
        // Automatically set is_locked = true if window elapsed
        await client.query('UPDATE collections SET is_locked = true WHERE id = $1', [collectionId]);
        throw new Error('Collection record is older than 7 days and is permanently locked against modifications');
      }

      const amountPaisa = input.amountPaisa ?? current.amount_paisa;
      const collectionDate = input.collectionDate ?? current.collection_date;

      if (!Number.isInteger(Number(amountPaisa)) || Number(amountPaisa) <= 0) {
        throw new Error('Amount must be a positive integer representing paisa');
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

  /**
   * Locks a collection record against any further alteration
   */
  static async lockCollection(
    collectionId: string,
    actorId: string,
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

  /**
   * Marks a collection as transferred to the central bank account
   */
  static async markTransferred(
    collectionId: string,
    actorId: string,
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

  /**
   * Retrieves collections for a branch with branch metadata
   */
  static async listCollections(branchId?: string) {
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

  /**
   * Retrieves all unrouted collections (not yet remitted to central account)
   */
  static async listUnroutedCollections(branchId?: string) {
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