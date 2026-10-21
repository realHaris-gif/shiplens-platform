import { PoolClient } from 'pg';
import { AuditLogEntry } from '../types';

export class AuditService {
  /**
   * Logs an immutable audit entry inside an active transaction.
   * @param client Active PostgreSQL transaction client
   * @param entry Audit details
   */
  static async log(client: PoolClient, entry: AuditLogEntry): Promise<void> {
    const query = `
      INSERT INTO audit_logs (
        actor_id,
        action,
        entity_type,
        record_id,
        before_state,
        after_state,
        ip_address
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    const values = [
      entry.actor_id || null,
      entry.action,
      entry.entity_type,
      entry.record_id,
      entry.before_state ? JSON.stringify(entry.before_state) : null,
      entry.after_state ? JSON.stringify(entry.after_state) : null,
      entry.ip_address || null,
    ];

    await client.query(query, values);
  }
}