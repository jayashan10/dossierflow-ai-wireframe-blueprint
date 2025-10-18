import type { Request, Response } from 'express';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({
    error: 'NotFound',
    message: 'The requested resource was not found.'
  });
}
