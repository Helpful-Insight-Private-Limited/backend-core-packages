import { Request, RequestHandler } from 'express';

interface RoleDefinition {
    name: string;
    permissions: string[];
    description?: string;
    inherits?: string[];
}
interface RbacUser {
    id: string;
    roles?: string[];
    permissions?: string[];
    [key: string]: any;
}
type AbacRuleFn = (context: {
    user: RbacUser;
    req: any;
    resource?: any;
}) => boolean | Promise<boolean>;
interface IRbacStore {
    getUserRoles(userId: string): Promise<string[]>;
    getUserPermissions(userId: string): Promise<string[]>;
    assignRole(userId: string, roleName: string): Promise<void>;
    revokeRole(userId: string, roleName: string): Promise<void>;
}

/**
 * Check if an array of granted permissions satisfies a required permission, supporting wildcards.
 *
 * Examples:
 * - '*' satisfies 'users:read'
 * - 'users:*' satisfies 'users:read', 'users:write'
 * - 'users:read' satisfies 'users:read', but NOT 'users:write'
 * - 'reports:2026:*' satisfies 'reports:2026:download'
 */
declare function matchPermission(granted: string, required: string): boolean;
declare function hasPermission(grantedList: string[], required: string): boolean;
declare function hasAllPermissions(grantedList: string[], requiredList: string[]): boolean;
declare function hasAnyPermission(grantedList: string[], requiredList: string[]): boolean;

declare class RbacEngine {
    private roles;
    private rules;
    constructor(initialRoles?: RoleDefinition[]);
    registerRole(role: RoleDefinition): void;
    registerRule(name: string, fn: AbacRuleFn): void;
    /**
     * Resolves all permissions granted to a list of roles, including inherited roles.
     */
    resolveRolePermissions(roleNames: string[]): string[];
    canUser(user: RbacUser, requiredPermission: string): boolean;
    canUserAll(user: RbacUser, requiredPermissions: string[]): boolean;
    canUserAny(user: RbacUser, requiredPermissions: string[]): boolean;
    evaluateRule(ruleName: string, context: {
        user: RbacUser;
        req: any;
        resource?: any;
    }): Promise<boolean>;
}

declare const PRISMA_RBAC_SCHEMA_SNIPPET = "\nmodel Role {\n  id          String           @id @default(uuid())\n  name        String           @unique\n  description String?\n  permissions RolePermission[]\n  users       UserRole[]\n  createdAt   DateTime         @default(now())\n}\n\nmodel Permission {\n  id          String           @id @default(uuid())\n  action      String           @unique\n  description String?\n  roles       RolePermission[]\n  createdAt   DateTime         @default(now())\n}\n\nmodel RolePermission {\n  roleId       String\n  permissionId String\n  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)\n\n  @@id([roleId, permissionId])\n}\n\nmodel UserRole {\n  userId    String\n  roleId    String\n  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)\n  createdAt DateTime @default(now())\n\n  @@id([userId, roleId])\n}\n";
declare class PrismaRbacAdapter implements IRbacStore {
    private prisma;
    constructor(prisma: any);
    getUserRoles(userId: string): Promise<string[]>;
    getUserPermissions(userId: string): Promise<string[]>;
    assignRole(userId: string, roleName: string): Promise<void>;
    revokeRole(userId: string, roleName: string): Promise<void>;
}

interface RbacGuardOptions {
    engine: RbacEngine;
    getUser?: (req: Request) => RbacUser | undefined;
}
declare class RbacGuard {
    private options;
    constructor(options: RbacGuardOptions);
    private extractUser;
    requirePermission(permission: string): RequestHandler;
    requireAllPermissions(...permissions: string[]): RequestHandler;
    requireAnyPermission(...permissions: string[]): RequestHandler;
    requireRole(roleName: string): RequestHandler;
    requireAnyRole(...roleNames: string[]): RequestHandler;
    requireRule(rule: string | AbacRuleFn, getResource?: (req: Request) => any): RequestHandler;
}

export { type AbacRuleFn, type IRbacStore, PRISMA_RBAC_SCHEMA_SNIPPET, PrismaRbacAdapter, RbacEngine, RbacGuard, type RbacGuardOptions, type RbacUser, type RoleDefinition, hasAllPermissions, hasAnyPermission, hasPermission, matchPermission };
