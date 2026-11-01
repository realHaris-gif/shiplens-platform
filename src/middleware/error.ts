// src/middleware/errors.ts
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(fields: Record<string, string>) {
    super(400, 'VALIDATION_FAILED', 'Validation failed', fields);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class RuleError extends AppError {
  constructor(code: string, message: string) {
    super(422, code, message);
  }
}

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  let errorInstance = err;

  // Map PostgreSQL native error codes
  if (err.code === '23505') {
    errorInstance = new ConflictError('DUPLICATE', 'Record already exists');
  } else if (err.code === '22P02') {
    errorInstance = new ValidationError({ id: 'INVALID_ID' });
  }

  const statusCode = errorInstance instanceof AppError ? errorInstance.statusCode : 500;
  const errorCode = errorInstance instanceof AppError ? errorInstance.code : 'INTERNAL_ERROR';
  const message = statusCode >= 500 ? 'Internal server error' : errorInstance.message;

  if (statusCode >= 500) {
    console.error(`[UNHANDLED ERROR] ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(statusCode).json({
    error: errorCode,
    message,
    ...(errorInstance.fields ? { fields: errorInstance.fields } : {})
  });
}