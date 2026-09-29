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
});
