import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { pool } from '../config/db';
import { AuthService } from '../services/auth.service';
import { AuditService } from '../services/audit.service';
import { Role } from '../types';

export class UserController {
  /**
   * POST /admin/users
   * Creates a new user with role and optional branch assignment.
   * Restricted to: SUPER_ADMIN
   */
  static async createUser(req: AuthenticatedRequest, res: Response) {
    const { email, password, name, role, branchId } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({ error: 'email, password, name, and role are required' });
    }

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${Object.values(Role).join(', ')}` });
    }

    if (role === Role.BRANCH_LEAD && !branchId) {
      return res.status(400).json({ error: 'branchId is required for BRANCH_LEAD' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
      if (existingUser.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'A user with this email already exists' });
      }

      if (branchId) {
        const branchCheck = await client.query('SELECT id, status FROM branches WHERE id = $1', [branchId]);
        if (branchCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Assigned branch does not exist' });
        }
      }

      const passwordHash = await AuthService.hashPassword(password);
      const insertRes = await client.query(
        `INSERT INTO users (email, password_hash, name, role, branch_id, is_active)
         VALUES ($1, $2, $3, $4, $5, true)
         RETURNING id, email, name, role, branch_id, is_active, created_at`,
        [email.toLowerCase().trim(), passwordHash, name.trim(), role, branchId || null]
      );

      const newUser = insertRes.rows[0];

      await AuditService.log(client, {
        actor_id: req.user!.userId,
        action: 'USER_CREATED',
        entity_type: 'USER',
        record_id: newUser.id,
        before_state: null,
        after_state: { email: newUser.email, role: newUser.role, branch_id: newUser.branch_id },
        ip_address: req.ip,
      });

      await client.query('COMMIT');
      return res.status(201).json(newUser);
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }

  /**
   * PATCH /admin/users/:id/status
   * Activates or deactivates a user.
   */
  static async setStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive boolean flag is required' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userRes = await client.query('SELECT id, email, role, branch_id, is_active FROM users WHERE id = $1 FOR UPDATE', [id]);
      if (userRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }

      const current = userRes.rows[0];
      const updateRes = await client.query(
        'UPDATE users SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, email, role, is_active',
        [isActive, id]
      );
      const updated = updateRes.rows[0];

      await AuditService.log(client, {
        actor_id: req.user!.userId,
        action: isActive ? 'USER_ACTIVATED' : 'USER_DEACTIVATED',
        entity_type: 'USER',
        record_id: id,
        before_state: current,
        after_state: updated,
        ip_address: req.ip,
      });

      await client.query('COMMIT');
      return res.status(200).json(updated);
    } catch (err: any) {
      await client.query('ROLLBACK');
      return res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  }
}