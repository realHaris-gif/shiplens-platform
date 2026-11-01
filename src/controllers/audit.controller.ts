import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { pool } from '../config/db';

export class AuditController {
  /**
   * GET /admin/audit
   * Searchable and filterable audit trail.
   * Restricted to: SUPER_ADMIN
   */
  static async list(req: AuthenticatedRequest, res: Response) {
    const { actorId, entityType, action, from, to, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let query = 'SELECT * FROM audit_logs WHERE 1=1';
    const params: any[] = [];

    if (actorId) {
      params.push(actorId);
      query += ` AND actor_id = $${params.length}`;
    }

    if (entityType) {
      params.push(entityType);
      query += ` AND entity_type = $${params.length}`;
    }

    if (action) {
      params.push(action);
      query += ` AND action = $${params.length}`;
    }

    if (from) {
      params.push(from);
      query += ` AND created_at >= $${params.length}`;
    }

    if (to) {
      params.push(to);
      query += ` AND created_at <= $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    try {
      const result = await pool.query(query, params);
      return res.status(200).json({
        page: pageNum,
        limit: limitNum,
        count: result.rows.length,
        logs: result.rows,
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  }
}