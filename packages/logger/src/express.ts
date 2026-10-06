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
  /**
   * Automatically record an audit event for every incoming HTTP request when auditService is provided.
   * Default: true
   */
  autoAudit?: boolean;
  /**
   * Paths that should be skipped from automatic audit logging (e.g. ['/health', '/docs']).
   * Default: ['/health', '/docs', '/favicon.ico']
   */
  excludeAuditPaths?: string[];
}

export function createHttpLoggerMiddleware(
  options: HttpLoggerMiddlewareOptions = {}
): RequestHandler {
  const loggerInstance = options.logger || defaultLogger;
  const audit = options.auditService;
  const headerName = options.headerName || 'x-request-id';
  const autoAudit = options.autoAudit ?? true;
  const defaultExcludes = ['/health', '/docs', '/favicon.ico'];
  const excludeAuditPaths = options.excludeAuditPaths
    ? [...defaultExcludes, ...options.excludeAuditPaths]
    : defaultExcludes;

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
          ? { id: String((req as any).user.id || (req as any).user.sub), email: (req as any).user.email }
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

      // 5. Automatic Audit Trail logging
      if (audit && autoAudit) {
        const url = req.originalUrl || req.url;
        const isExcluded = excludeAuditPaths.some((excludePath) => url.startsWith(excludePath));

        if (!isExcluded) {
          const user = (req as any).user;
          const actor = user
            ? { id: String(user.id || user.sub), email: user.email }
            : undefined;

          audit.record({
            actor,
            action: `HTTP_${req.method.toUpperCase()}`,
            resource: req.baseUrl || req.path || url.split('?')[0] || 'HTTP',
            targetId: req.id,
            status: res.statusCode >= 400 ? 'FAILURE' : 'SUCCESS',
            ipAddress: req.ip,
            userAgent: req.get('user-agent'),
            newValues: options.logBody && req.body && Object.keys(req.body).length > 0
              ? maskSensitiveData(req.body)
              : undefined,
            metadata: {
              method: req.method,
              url,
              statusCode: res.statusCode,
              durationMs
            }
          }).catch((err) => {
            scopedLogger.warn({ err }, 'Failed to record auto-audit log');
          });
        }
      }
    });

    next();
  };
}
