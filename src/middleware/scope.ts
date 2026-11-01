// src/middleware/scope.ts
import { Request, Response, NextFunction } from 'express';
import { ForbiddenError, ValidationError } from './error';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Backward-compatibility alias for legacy controllers
export class ScopeError extends ForbiddenError {
  constructor(message = 'Scope violation') {
    super(message);
    this.name = 'ScopeError';
  }
}

export function listScope(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;

  if (user.role === 'BRANCH_LEAD') {
    const branchId = user.branchId || user.branch_id;
    if (!branchId) throw new ForbiddenError('No branch assigned to lead');
    return branchId;
  }

  const queryBranch = req.query.branchId;
  if (typeof queryBranch === 'string' && queryBranch.trim()) {
    if (!UUID_REGEX.test(queryBranch)) {
      throw new ValidationError({ branchId: 'INVALID_ID' });
    }
    return queryBranch.trim();
  }

  return null;
}

export function ownBranchOrNull(req: Request): string | null {
  const user = (req as any).user;
  if (!user) return null;

  if (user.role === 'BRANCH_LEAD') {
    const branchId = user.branchId || user.branch_id;
    if (!branchId) throw new ForbiddenError('No branch assigned to lead');
    return branchId;
  }

  return null;
}

// Backward-compatible alias resolving to listScope
export function scopedBranchId(req: Request): string | null {
  return listScope(req);
}

export const validateUuidParam = (paramName = 'id') => (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const val = req.params[paramName];
  if (val && !UUID_REGEX.test(val)) {
    return next(new ValidationError({ [paramName]: 'INVALID_ID' }));
  }
  next();
};