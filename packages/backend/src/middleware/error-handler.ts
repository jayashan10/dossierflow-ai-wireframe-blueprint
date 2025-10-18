import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

interface HttpError extends Error {
  status?: number;
  details?: unknown;
}

export function errorHandler(err: HttpError, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: 'Request validation failed',
      details: err.flatten()
    });
  }

  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;

  return res.status(status).json({
    error: err.name || 'InternalServerError',
    message: err.message || 'An unexpected error occurred',
    details: err.details
  });
}
