import { describe, it, expect } from 'vitest';
import { maskSensitiveData } from './sanitizer.js';
import { AuditService, MemoryAuditRepository } from './audit.js';

describe('@core/logger', () => {
  describe('Sanitizer', () => {
    it('should recursively mask passwords, tokens and secrets', () => {
      const payload = {
        username: 'john',
        password: 'SuperSecretPassword!',
        token: 'eyJh...',
        nested: {
          apiKey: 'key-12345',
          publicInfo: 'visible'
        }
      };

      const cleaned = maskSensitiveData(payload);
      expect(cleaned.username).toBe('john');
      expect(cleaned.password).toBe('[REDACTED]');
      expect(cleaned.token).toBe('[REDACTED]');
      expect(cleaned.nested.apiKey).toBe('[REDACTED]');
      expect(cleaned.nested.publicInfo).toBe('visible');
    });
  });

  describe('AuditService', () => {
    it('should record audit events and mask sensitive fields', async () => {
      const repo = new MemoryAuditRepository();
      const service = new AuditService(repo);

      const event = await service.record({
        actor: { id: 'user_123', type: 'user' },
        action: 'UPDATE_PASSWORD',
        resource: 'User',
        targetId: 'user_123',
        newValues: { password: 'new-plain-password', role: 'admin' }
      });

      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.newValues.password).toBe('[REDACTED]');
      expect(event.newValues.role).toBe('admin');

      const recent = await service.getRecent(10);
      expect(recent.length).toBe(1);
      expect(recent[0].action).toBe('UPDATE_PASSWORD');
    });
  });

  describe('createHttpLoggerMiddleware', () => {
    it('should automatically record an audit event when autoAudit is enabled', async () => {
      const repo = new MemoryAuditRepository();
      const service = new AuditService(repo);

      const { createHttpLoggerMiddleware } = await import('./express.js');
      const middleware = createHttpLoggerMiddleware({
        auditService: service,
        autoAudit: true,
        excludeAuditPaths: ['/health']
      });

      const finishCallbacks: Array<() => void> = [];
      const req: any = {
        headers: {},
        method: 'POST',
        originalUrl: '/api/orders',
        url: '/api/orders',
        ip: '127.0.0.1',
        get: () => 'TestAgent/1.0',
        body: { orderId: 101, amount: 500 }
      };

      const res: any = {
        statusCode: 200,
        setHeader: () => {},
        on: (event: string, cb: () => void) => {
          if (event === 'finish') finishCallbacks.push(cb);
        }
      };

      const next = () => {};
      middleware(req, res, next);

      // Trigger finish
      finishCallbacks.forEach((cb) => cb());

      const logs = await service.getRecent();
      expect(logs.length).toBe(1);
      expect(logs[0].action).toBe('HTTP_POST');
      expect(logs[0].status).toBe('SUCCESS');
      expect(logs[0].metadata?.url).toBe('/api/orders');
    });

    it('should skip audit when path is in excludeAuditPaths', async () => {
      const repo = new MemoryAuditRepository();
      const service = new AuditService(repo);

      const { createHttpLoggerMiddleware } = await import('./express.js');
      const middleware = createHttpLoggerMiddleware({
        auditService: service,
        autoAudit: true,
        excludeAuditPaths: ['/health']
      });

      const finishCallbacks: Array<() => void> = [];
      const req: any = {
        headers: {},
        method: 'GET',
        originalUrl: '/health',
        url: '/health',
        ip: '127.0.0.1',
        get: () => 'TestAgent/1.0'
      };

      const res: any = {
        statusCode: 200,
        setHeader: () => {},
        on: (event: string, cb: () => void) => {
          if (event === 'finish') finishCallbacks.push(cb);
        }
      };

      middleware(req, res, () => {});
      finishCallbacks.forEach((cb) => cb());

      const logs = await service.getRecent();
      expect(logs.length).toBe(0);
    });
  });
});
