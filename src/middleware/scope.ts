import { Request } from 'express';
import { Role } from '../types';

export class ScopeError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 403) {
    super(message);
    this.name = 'ScopeError';
    this.statusCode = statusCode;
  }
}

export function scopedBranchId(req: Request): string | null {
  const user = (req as any).user;
  if (!user) {
    throw new ScopeError('Authentication required to verify branch scope', 401);
  }

  if (user.role === Role.BRANCH_LEAD) {
    const branchId = user.branchId || user.branch_id;
    if (!branchId) {
      throw new ScopeError('Branch Lead has no assigned branch', 403);
    }
    return branchId;
  }

  if (req.query && typeof req.query.branchId === 'string' && req.query.branchId.trim().length > 0) {
    return req.query.branchId.trim();
  }

  return null;
}