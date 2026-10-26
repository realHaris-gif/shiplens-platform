import { pool } from '../config/db';
import { ContentStatus } from '../types';
import { AuditService } from './audit.service';

export interface CreateContentInput {
  slug: string;
  title: string;
  summary?: string;
  body: string;
  category?: string;
}

export interface UpdateContentInput {
  title?: string;
  summary?: string;
  body?: string;
  category?: string;
  slug?: string;
}

export class ContentService {
  /**
   * Generates a URL-friendly slug
   */
  static slugify(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Create draft content
   */
  static async createDraft(
    input: CreateContentInput,
    authorId: string,
    ipAddress?: string
  ) {
    const slug = input.slug ? this.slugify(input.slug) : this.slugify(input.title);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        INSERT INTO content_items (slug, title, summary, body, category, author_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const res = await client.query(query, [
        slug,
        input.title,
        input.summary || null,
        input.body,
        input.category || 'ANNOUNCEMENT',
        authorId,
        ContentStatus.DRAFT,
      ]);

      const item = res.rows[0];

      await AuditService.log(client, {
        actor_id: authorId,
        action: 'CONTENT_DRAFT_CREATED',
        entity_type: 'CONTENT_ITEM',
        record_id: item.id,
        before_state: null,
        after_state: item,
        ip_address: ipAddress || null,
      });

      await client.query('COMMIT');
      return item;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Update content details (only allowed if not published, or creates new revision)
   */
  static async updateContent(
    id: string,
    input: UpdateContentInput,
    actorId: string,
    ipAddress?: string
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query('SELECT * FROM content_items WHERE id = $1 FOR UPDATE', [id]);
      if (selectRes.rows.length === 0) {
        throw new Error('Content item not found');
      }

      const current = selectRes.rows[0];
      const title = input.title ?? current.title;
      const summary = input.summary !== undefined ? input.summary : current.summary;
      const body = input.body ?? current.body;
      const category = input.category ?? current.category;
      const slug = input.slug ? this.slugify(input.slug) : current.slug;

      const updateQuery = `
        UPDATE content_items
        SET title = $1, summary = $2, body = $3, category = $4, slug = $5, updated_at = CURRENT_TIMESTAMP
        WHERE id = $6
        RETURNING *
      `;
      const res = await client.query(updateQuery, [title, summary, body, category, slug, id]);
      const updated = res.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'CONTENT_UPDATED',
        entity_type: 'CONTENT_ITEM',
        record_id: id,
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
   * Publish content item to the public site
   */
  static async publishContent(id: string, actorId: string, ipAddress?: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query('SELECT * FROM content_items WHERE id = $1 FOR UPDATE', [id]);
      if (selectRes.rows.length === 0) {
        throw new Error('Content item not found');
      }
      const current = selectRes.rows[0];

      const updateQuery = `
        UPDATE content_items
        SET status = $1, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const res = await client.query(updateQuery, [ContentStatus.PUBLISHED, id]);
      const updated = res.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'CONTENT_PUBLISHED',
        entity_type: 'CONTENT_ITEM',
        record_id: id,
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
   * Unpublish content item back to draft
   */
  static async unpublishContent(id: string, actorId: string, ipAddress?: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const selectRes = await client.query('SELECT * FROM content_items WHERE id = $1 FOR UPDATE', [id]);
      if (selectRes.rows.length === 0) {
        throw new Error('Content item not found');
      }
      const current = selectRes.rows[0];

      const updateQuery = `
        UPDATE content_items
        SET status = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;
      const res = await client.query(updateQuery, [ContentStatus.DRAFT, id]);
      const updated = res.rows[0];

      await AuditService.log(client, {
        actor_id: actorId,
        action: 'CONTENT_UNPUBLISHED',
        entity_type: 'CONTENT_ITEM',
        record_id: id,
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
   * Public endpoint query: Only returns items where status = PUBLISHED
   */
  static async listPublicContent(category?: string) {
    let query = `
      SELECT id, slug, title, summary, body, category, published_at
      FROM content_items
      WHERE status = 'PUBLISHED'
    `;
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND category = $${params.length}`;
    }

    query += ' ORDER BY published_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }

  /**
   * Editor endpoint query: Returns all items including drafts
   */
  static async listAllContent(category?: string) {
    let query = `
      SELECT c.*, u.name AS author_name
      FROM content_items c
      LEFT JOIN users u ON c.author_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (category) {
      params.push(category);
      query += ` AND c.category = $${params.length}`;
    }

    query += ' ORDER BY c.updated_at DESC';
    const res = await pool.query(query, params);
    return res.rows;
  }
}