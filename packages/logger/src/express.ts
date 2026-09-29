import { Request, Response, NextFunction, RequestHandler } from 'express';
import * as crypto from 'crypto';
import { AppLogger, defaultLogger } from './logger.js';
import { AuditService, AuditEventInput } from './audit.js';
import { maskSensitiveData } from './sanitizer.js';
import { Logger as PinoLogger } from 'pino';

declare global {
  namespace Express {
    interface Request {
      id: string;
      logger: PinoLogger;
      audit?: (event: Omit<AuditEventInput, 'ipAddress' | 'userAgent'>) => Promise<any>;
    }
  }
}

export interface HttpLoggerMiddlewareOptions {
  logger?: AppLogger;
  auditService?: AuditService;
  headerName?: string;
  logBody?: boolean;
}

export function createHttpLoggerMiddleware(
  options: HttpLoggerMiddlewareOptions = {}
): RequestHandler {
  const loggerInstance = options.logger || defaultLogger;
  const audit = options.auditService;
  const headerName = options.headerName || 'x-request-id';

  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime();

    // 1. Get or generate correlation ID
    const incomingId = req.headers[headerName.toLowerCase()];
    const requestId =
      typeof incomingId === 'string' && incomingId.trim().length > 0
        ? incomingId
        : crypto.randomUUID();

    req.id = requestId;
    res.setHeader(headerName, requestId);

    // 2. Create child logger scoped to this request
    const scopedLogger = loggerInstance.child({
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip
    });
    req.logger = scopedLogger;

    // 3. Attach audit helper
    if (audit) {
      req.audit = (event) => {
        const actor = (req as any).user
          ? { id: String((req as any).user.id), email: (req as any).user.email }
          : event.actor;

        return audit.record({
          ...event,
          actor,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        });
      };
    }

    // 4. Hook response finish
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = Math.round((seconds * 1000 + nanoseconds / 1e6) * 100) / 100;

      const logData: any = {
        statusCode: res.statusCode,
        durationMs
      };

      if (options.logBody && req.body && Object.keys(req.body).length > 0) {
        logData.body = maskSensitiveData(req.body);
      }

      if (res.statusCode >= 500) {
        scopedLogger.error({ ...logData }, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`);
      } else if (res.statusCode >= 400) {
        scopedLogger.warn({ ...logData }, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`);
      } else {
        scopedLogger.info({ ...logData }, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`);
      }
    });

    next();
  };
}
