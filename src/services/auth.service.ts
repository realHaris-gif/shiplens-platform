import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/db';
import { Role } from '../types';

// Fail fast in production if JWT_SECRET is missing or insecure
const JWT_SECRET = process.env.JWT_SECRET || (
  process.env.NODE_ENV === 'production'
    ? (() => { throw new Error('FATAL: JWT_SECRET environment variable is missing in production'); })()
    : 'shiplens-local-development-secret-key-min-32-chars-long'
);

if (process.env.NODE_ENV === 'production' && JWT_SECRET.length < 32) {
  throw new Error('FATAL: JWT_SECRET must be at least 32 characters in production');
}

const JWT_EXPIRES_IN = '8h';

// Pre-computed dummy hash to neutralize timing leaks when user does not exist
const DUMMY_HASH = '$2a$12$e8Yk26DgnW7pDskxK6Gffu8Fq7W.s377eDq5zL0Zf4fF0w6qGeqx.';

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  branchId?: string | null;
}

export class AuthService {
  static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12);
  }

  static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  static signToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      algorithm: 'HS256',
    });
  }

  static verifyToken(token: string): TokenPayload {
    // Explicitly pin algorithm to prevent algorithm downgrade attacks
    return jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  }

  static async login(email: string, passwordPlain: string) {
    const cleanEmail = email ? email.toLowerCase().trim() : '';

    const res = await pool.query(
      'SELECT id, email, password_hash, name, role, branch_id, is_active FROM users WHERE email = $1',
      [cleanEmail]
    );

    const user = res.rows[0];

    // SEC-3: Mitigate timing attacks and user enumeration
    if (!user) {
      await bcrypt.compare(passwordPlain, DUMMY_HASH);
      throw new Error('Invalid email or password');
    }

    const isValid = await bcrypt.compare(passwordPlain, user.password_hash);

    // SEC-3: Generic error prevents revealing if account is disabled vs bad password
    if (!isValid || !user.is_active) {
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