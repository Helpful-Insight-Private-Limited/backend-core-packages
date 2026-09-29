import { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Response {
      ok: (data?: any, meta?: Record<string, any>, statusCode?: number) => void;
      fail: (code: string, message: string, statusCode?: number, details?: any) => void;
    }
  }
}

export function responseEnvelopeMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.ok = (data = null, meta?: Record<string, any>, statusCode = 200) => {
      res.status(statusCode).json({
        success: true,
        data,
        ...(meta ? { meta } : {}),
        timestamp: new Date().toISOString()
      });
    };

    res.fail = (code: string, message: string, statusCode = 400, details?: any) => {
      res.status(statusCode).json({
        success: false,
        error: {
          code,
          message,
          ...(details ? { details } : {})
        },
        timestamp: new Date().toISOString()
      });
    };

    next();
  };
}
