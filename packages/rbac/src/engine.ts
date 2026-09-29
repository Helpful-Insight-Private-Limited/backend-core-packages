import { RoleDefinition, RbacUser, AbacRuleFn } from './types.js';
import { hasPermission, hasAllPermissions, hasAnyPermission } from './matcher.js';

export class RbacEngine {
  private roles: Map<string, RoleDefinition> = new Map();
  private rules: Map<string, AbacRuleFn> = new Map();

  constructor(initialRoles: RoleDefinition[] = []) {
    for (const role of initialRoles) {
      this.registerRole(role);
    }
  }

  public registerRole(role: RoleDefinition): void {
    this.roles.set(role.name.toLowerCase(), {
      ...role,
      name: role.name.toLowerCase(),
      inherits: role.inherits?.map((r) => r.toLowerCase())
    });
  }

  public registerRule(name: string, fn: AbacRuleFn): void {
    this.rules.set(name, fn);
  }

  /**
   * Resolves all permissions granted to a list of roles, including inherited roles.
   */
  public resolveRolePermissions(roleNames: string[]): string[] {
    const permissions = new Set<string>();
    const visitedRoles = new Set<string>();

    const traverse = (roleName: string) => {
      const lower = roleName.toLowerCase();
      if (visitedRoles.has(lower)) return;
      visitedRoles.add(lower);

      const role = this.roles.get(lower);
      if (!role) return;

      for (const perm of role.permissions) {
        permissions.add(perm);
      }

      if (role.inherits) {
        for (const inherited of role.inherits) {
          traverse(inherited);
        }
      }
    };

    for (const r of roleNames) {
      traverse(r);
    }

    return Array.from(permissions);
  }

  public canUser(user: RbacUser, requiredPermission: string): boolean {
    const directPerms = user.permissions || [];
    const rolePerms = user.roles ? this.resolveRolePermissions(user.roles) : [];
    const allPerms = [...directPerms, ...rolePerms];
    return hasPermission(allPerms, requiredPermission);
  }

  public canUserAll(user: RbacUser, requiredPermissions: string[]): boolean {
    const directPerms = user.permissions || [];
    const rolePerms = user.roles ? this.resolveRolePermissions(user.roles) : [];
    const allPerms = [...directPerms, ...rolePerms];
    return hasAllPermissions(allPerms, requiredPermissions);
  }

  public canUserAny(user: RbacUser, requiredPermissions: string[]): boolean {
    const directPerms = user.permissions || [];
    const rolePerms = user.roles ? this.resolveRolePermissions(user.roles) : [];
    const allPerms = [...directPerms, ...rolePerms];
    return hasAnyPermission(allPerms, requiredPermissions);
  }

  public async evaluateRule(
    ruleName: string,
    context: { user: RbacUser; req: any; resource?: any }
  ): Promise<boolean> {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`ABAC Rule '${ruleName}' is not registered`);
    }
    return Boolean(await rule(context));
  }
}
