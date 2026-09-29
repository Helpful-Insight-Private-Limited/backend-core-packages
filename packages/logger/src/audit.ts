import { maskSensitiveData } from './sanitizer.js';

export interface AuditActor {
  id: string;
  type?: 'user' | 'system' | 'api_key' | 'service';
  email?: string;
}

export interface AuditEventInput {
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

export interface AuditEventRecord extends AuditEventInput {
  id: string;
  timestamp: Date;
}

export interface IAuditRepository {
  save(event: AuditEventRecord): Promise<void>;
  findRecent(limit?: number): Promise<AuditEventRecord[]>;
  findByTarget(resource: string, targetId: string): Promise<AuditEventRecord[]>;
}

export class MemoryAuditRepository implements IAuditRepository {
  private events: AuditEventRecord[] = [];

  async save(event: AuditEventRecord): Promise<void> {
    this.events.unshift(event);
  }

  async findRecent(limit = 50): Promise<AuditEventRecord[]> {
    return this.events.slice(0, limit);
  }

  async findByTarget(resource: string, targetId: string): Promise<AuditEventRecord[]> {
    return this.events.filter(
      (e) => e.resource === resource && e.targetId === targetId
    );
  }

  clear(): void {
    this.events = [];
  }
}

export class ConsoleAuditRepository implements IAuditRepository {
  async save(event: AuditEventRecord): Promise<void> {
    console.log('[AUDIT_LOG]', JSON.stringify(event));
  }

  async findRecent(): Promise<AuditEventRecord[]> {
    return [];
  }

  async findByTarget(): Promise<AuditEventRecord[]> {
    return [];
  }
}

/**
 * Adapter that connects directly to a Prisma client model named `auditLog`
 */
export class PrismaAuditRepository implements IAuditRepository {
  constructor(private prismaClient: any) {}

  async save(event: AuditEventRecord): Promise<void> {
    if (!this.prismaClient?.auditLog) {
      throw new Error('Prisma client does not have an auditLog model configured');
    }

    await this.prismaClient.auditLog.create({
      data: {
        actorId: event.actor?.id,
        actorType: event.actor?.type || 'user',
        action: event.action,
        resource: event.resource,
        targetId: event.targetId,
        status: event.status || 'SUCCESS',
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        oldValues: event.oldValues ? JSON.stringify(event.oldValues) : null,
        newValues: event.newValues ? JSON.stringify(event.newValues) : null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        timestamp: event.timestamp
      }
    });
  }

  async findRecent(limit = 50): Promise<AuditEventRecord[]> {
    if (!this.prismaClient?.auditLog) return [];
    const rows = await this.prismaClient.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: 'desc' }
    });
    return rows.map((r: any) => ({
      id: r.id,
      actor: { id: r.actorId, type: r.actorType },
      action: r.action,
      resource: r.resource,
      targetId: r.targetId,
      status: r.status,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      oldValues: r.oldValues ? JSON.parse(r.oldValues) : undefined,
      newValues: r.newValues ? JSON.parse(r.newValues) : undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      timestamp: r.timestamp
    }));
  }

  async findByTarget(resource: string, targetId: string): Promise<AuditEventRecord[]> {
    if (!this.prismaClient?.auditLog) return [];
    const rows = await this.prismaClient.auditLog.findMany({
      where: { resource, targetId },
      orderBy: { timestamp: 'desc' }
    });
    return rows.map((r: any) => ({
      id: r.id,
      actor: { id: r.actorId, type: r.actorType },
      action: r.action,
      resource: r.resource,
      targetId: r.targetId,
      status: r.status,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      oldValues: r.oldValues ? JSON.parse(r.oldValues) : undefined,
      newValues: r.newValues ? JSON.parse(r.newValues) : undefined,
      metadata: r.metadata ? JSON.parse(r.metadata) : undefined,
      timestamp: r.timestamp
    }));
  }
}

export class AuditService {
  constructor(private repository: IAuditRepository = new MemoryAuditRepository()) {}

  async record(input: AuditEventInput): Promise<AuditEventRecord> {
    const record: AuditEventRecord = {
      ...input,
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      oldValues: maskSensitiveData(input.oldValues),
      newValues: maskSensitiveData(input.newValues),
      metadata: maskSensitiveData(input.metadata),
      status: input.status || 'SUCCESS',
      timestamp: new Date()
    };

    try {
      await this.repository.save(record);
    } catch (err) {
      console.error('[AuditService] Failed to persist audit record:', err);
    }

    return record;
  }

  async getRecent(limit?: number): Promise<AuditEventRecord[]> {
    return this.repository.findRecent(limit);
  }

  async getForTarget(resource: string, targetId: string): Promise<AuditEventRecord[]> {
    return this.repository.findByTarget(resource, targetId);
  }
}
