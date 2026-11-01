// src/services/contact.service.ts
import { pool } from '../config/db';
import { ValidationError } from '../middleware/error';

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  ipAddress?: string;
}

export class ContactService {
  static async submitMessage(input: ContactInput) {
    const name = (input.name || '').trim();
    const email = (input.email || '').trim().toLowerCase();
    const message = (input.message || '').trim();

    const fields: Record<string, string> = {};
    if (!name) fields.name = 'REQUIRED';
    if (!email) fields.email = 'REQUIRED';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'INVALID_EMAIL';
    if (!message) fields.message = 'REQUIRED';
    else if (message.length > 2000) fields.message = 'TOO_LONG';

    if (Object.keys(fields).length > 0) {
      throw new ValidationError(fields);
    }

    const res = await pool.query(
      `INSERT INTO contact_messages (name, email, message, ip_address)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [name, email, message, input.ipAddress || null]
    );

    return res.rows[0];
  }
}