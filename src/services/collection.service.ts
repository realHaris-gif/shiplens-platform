import { pool } from '../config/db';
import { AuditService } from './audit.service';

export interface CreateCollectionInput {
  branchId: string;
  amountPaisa: number;
  collectionDate: string; // YYYY-MM-DD
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
        "SELECT status FROM branches WHERE id = $1",
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
        ip_address: ipAddress,
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
   * Retrieves collections for a branch
   */
  static async listCollections(branchId?: string) {
    let query = 'SELECT * FROM collections WHERE 1=1';
    const params: any[] = [];

    if (branchId) {
      params.push(branchId);
      query += ` AND branch_id = $${params.length}`;
    }

    query += ' ORDER BY collection_date DESC, created_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }
}