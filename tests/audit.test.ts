import { pool } from '../src/config/db';
import { AuditService } from '../src/services/audit.service';
import { runMigrations } from '../src/db/migrate';

describe('Audit Trail & Database Constraints', () => {
  beforeAll(async () => {
    await runMigrations();
  });

  it('should insert an audit record inside a transaction', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await AuditService.log(client, {
        actor_id: null,
        action: 'TEST_ACTION',
        entity_type: 'BRANCH',
        record_id: '1000',
        before_state: null,
        after_state: { name: 'Test Branch' },
      });
      await client.query('COMMIT');

      const res = await pool.query(
        "SELECT * FROM audit_logs WHERE action = 'TEST_ACTION' AND record_id = '1000'"
      );
      expect(res.rows.length).toBeGreaterThan(0);
      expect(res.rows[0].entity_type).toBe('BRANCH');
    } finally {
      client.release();
    }
  });

  it('should prevent UPDATE on audit_logs by throwing an exception', async () => {
    const insertRes = await pool.query(`
      INSERT INTO audit_logs (action, entity_type, record_id)
      VALUES ('IMMUTABLE_CHECK', 'TEST', '999')
      RETURNING id
    `);
    const recordId = insertRes.rows[0].id;

    await expect(
      pool.query(`UPDATE audit_logs SET action = 'ALTERED' WHERE id = $1`, [recordId])
    ).rejects.toThrow('Audit trail records are immutable and cannot be updated or deleted.');
  });

  it('should prevent DELETE on audit_logs by throwing an exception', async () => {
    const insertRes = await pool.query(`
      INSERT INTO audit_logs (action, entity_type, record_id)
      VALUES ('DELETE_CHECK', 'TEST', '998')
      RETURNING id
    `);
    const recordId = insertRes.rows[0].id;

    await expect(
      pool.query(`DELETE FROM audit_logs WHERE id = $1`, [recordId])
    ).rejects.toThrow('Audit trail records are immutable and cannot be updated or deleted.');
  });
});