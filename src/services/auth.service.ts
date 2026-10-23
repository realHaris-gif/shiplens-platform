import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { Role } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'shiplens-dev-insecure-secret-key-replace-in-prod';
const JWT_EXPIRES_IN = '8h';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  branchId?: string | null;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }

  static async login(email: string, passwordPlain: string) {
    const res = await pool.query(
      'SELECT id, email, password_hash, name, role, branch_id, is_active FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    if (res.rows.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = res.rows[0];

    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    const isValid = await bcrypt.compare(passwordPlain, user.password_hash);
    if (!isValid) {
      throw new Error('Invalid email or password');
    }

    const tokenPayload: TokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as Role,
      branchId: user.branch_id,
    };

    const token = this.signToken(tokenPayload);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        branchId: user.branch_id,
      },
    };
  }
}