import { Request, Response, NextFunction } from 'express';

export function globalErrorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (req.logger) {
    req.logger.error({ err, path: req.path, method: req.method }, `Unhandled Error: ${message}`);
  } else {
    console.error('Unhandled Error:', err);
  }

  res.status(statusCode).json({
    type: 'https://tools.ietf.org/html/rfc7807',
    title: err.name || 'InternalServerError',
    status: statusCode,
    detail: process.env.NODE_ENV === 'production' && statusCode === 500 ? 'An unexpected error occurred.' : message,
    instance: req.originalUrl || req.url,
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
}
