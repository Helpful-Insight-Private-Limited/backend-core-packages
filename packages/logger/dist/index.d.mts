import { Logger } from 'pino';
import { RequestHandler } from 'express';

interface AppLoggerOptions {
    level?: string;
    name?: string;
    redactPaths?: string[];
    prettyPrint?: boolean;
}
declare class AppLogger {
    private pinoInstance;
    constructor(options?: AppLoggerOptions);
    getRawLogger(): Logger;
    info(msg: string, obj?: any): void;
    warn(msg: string, obj?: any): void;
    error(msg: string, err?: any): void;
    debug(msg: string, obj?: any): void;
    child(bindings: Record<string, any>): Logger;
}
declare const defaultLogger: AppLogger;

interface AuditActor {
    id: string;
    type?: 'user' | 'system' | 'api_key' | 'service';
    email?: string;
}
interface AuditEventInput {
    actor?: AuditActor;
    action: string;
    resource: string;
    targetId?: string;
    status?: 'SUCCESS' | 'FAILURE';
    ipAddress?: string;
    userAgent?: string;
    oldValues?: any;
    newValues?: any;
    metadata?: Record<string, any>;
}
interface AuditEventRecord extends AuditEventInput {
    id: string;
    timestamp: Date;
}
interface IAuditRepository {
    save(event: AuditEventRecord): Promise<void>;
    findRecent(limit?: number): Promise<AuditEventRecord[]>;
    findByTarget(resource: string, targetId: string): Promise<AuditEventRecord[]>;
}
declare class MemoryAuditRepository implements IAuditRepository {
    private events;
    save(event: AuditEventRecord): Promise<void>;
    findRecent(limit?: number): Promise<AuditEventRecord[]>;
    findByTarget(resource: string, targetId: string): Promise<AuditEventRecord[]>;
    clear(): void;
}
declare class ConsoleAuditRepository implements IAuditRepository {
    save(event: AuditEventRecord): Promise<void>;
    findRecent(): Promise<AuditEventRecord[]>;
    findByTarget(): Promise<AuditEventRecord[]>;
}
/**
 * Adapter that connects directly to a Prisma client model named `auditLog`
 */
declare class PrismaAuditRepository implements IAuditRepository {
    private prismaClient;
    constructor(prismaClient: any);
    save(event: AuditEventRecord): Promise<void>;
    findRecent(limit?: number): Promise<AuditEventRecord[]>;
    findByTarget(resource: string, targetId: string): Promise<AuditEventRecord[]>;
}
declare class AuditService {
    private repository;
    constructor(repository?: IAuditRepository);
    record(input: AuditEventInput): Promise<AuditEventRecord>;
    getRecent(limit?: number): Promise<AuditEventRecord[]>;
    getForTarget(resource: string, targetId: string): Promise<AuditEventRecord[]>;
}

declare function maskSensitiveData(data: any, customKeys?: string[]): any;

declare global {
    namespace Express {
        interface Request {
            id: string;
            logger: Logger;
            audit?: (event: Omit<AuditEventInput, 'ipAddress' | 'userAgent'>) => Promise<any>;
        }
    }
}
interface HttpLoggerMiddlewareOptions {
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
declare function createHttpLoggerMiddleware(options?: HttpLoggerMiddlewareOptions): RequestHandler;

export { AppLogger, type AppLoggerOptions, type AuditActor, type AuditEventInput, type AuditEventRecord, AuditService, ConsoleAuditRepository, type HttpLoggerMiddlewareOptions, type IAuditRepository, MemoryAuditRepository, PrismaAuditRepository, createHttpLoggerMiddleware, defaultLogger, maskSensitiveData };
