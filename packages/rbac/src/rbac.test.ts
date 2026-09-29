import { describe, it, expect, beforeEach } from 'vitest';
import { RbacEngine } from './engine.js';
import { matchPermission } from './matcher.js';

describe('@core/rbac', () => {
  describe('Permission Matcher', () => {
    it('should match exact permissions', () => {
      expect(matchPermission('users:read', 'users:read')).toBe(true);
      expect(matchPermission('users:read', 'users:write')).toBe(false);
    });

    it('should match wildcard * for everything', () => {
      expect(matchPermission('*', 'users:read')).toBe(true);
      expect(matchPermission('*', 'billing:invoices:delete')).toBe(true);
    });

    it('should match segment wildcards', () => {
      expect(matchPermission('users:*', 'users:read')).toBe(true);
      expect(matchPermission('users:*', 'users:delete')).toBe(true);
      expect(matchPermission('users:*', 'posts:delete')).toBe(false);
    });
  });

  describe('RbacEngine', () => {
    let engine: RbacEngine;

    beforeEach(() => {
      engine = new RbacEngine([
        {
          name: 'viewer',
          permissions: ['users:read', 'posts:read']
        },
        {
          name: 'editor',
          permissions: ['posts:write', 'posts:delete'],
          inherits: ['viewer']
        },
        {
          name: 'admin',
          permissions: ['*']
        }
      ]);
    });

    it('should inherit permissions through role hierarchy', () => {
      const editorPerms = engine.resolveRolePermissions(['editor']);
      expect(editorPerms).toContain('posts:write');
      expect(editorPerms).toContain('posts:read'); // inherited from viewer
      expect(editorPerms).toContain('users:read'); // inherited from viewer
    });

    it('should correctly evaluate user permissions', () => {
      const viewerUser = { id: 'u1', roles: ['viewer'] };
      expect(engine.canUser(viewerUser, 'users:read')).toBe(true);
      expect(engine.canUser(viewerUser, 'users:delete')).toBe(false);

      const adminUser = { id: 'u2', roles: ['admin'] };
      expect(engine.canUser(adminUser, 'anything:destroy')).toBe(true);
    });

    it('should evaluate dynamic ABAC rules', async () => {
      engine.registerRule('isOwner', ({ user, resource }) => {
        return user.id === resource.authorId;
      });

      const allowed = await engine.evaluateRule('isOwner', {
        user: { id: 'usr_100' },
        req: {},
        resource: { authorId: 'usr_100' }
      });
      expect(allowed).toBe(true);

      const denied = await engine.evaluateRule('isOwner', {
        user: { id: 'usr_100' },
        req: {},
        resource: { authorId: 'usr_999' }
      });
      expect(denied).toBe(false);
    });
  });
});
