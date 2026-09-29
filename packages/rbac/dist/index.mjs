// src/matcher.ts
function matchPermission(granted, required) {
  if (granted === "*" || granted === required) {
    return true;
  }
  const grantedParts = granted.split(":");
  const requiredParts = required.split(":");
  for (let i = 0; i < grantedParts.length; i++) {
    const gPart = grantedParts[i];
    if (gPart === "*") {
      return true;
    }
    if (gPart !== requiredParts[i]) {
      return false;
    }
  }
  return grantedParts.length === requiredParts.length;
}
function hasPermission(grantedList, required) {
  return grantedList.some((granted) => matchPermission(granted, required));
}
function hasAllPermissions(grantedList, requiredList) {
  return requiredList.every((required) => hasPermission(grantedList, required));
}
function hasAnyPermission(grantedList, requiredList) {
  return requiredList.some((required) => hasPermission(grantedList, required));
}

// src/engine.ts
var RbacEngine = class {
  roles = /* @__PURE__ */ new Map();
  rules = /* @__PURE__ */ new Map();
  constructor(initialRoles = []) {
    for (const role of initialRoles) {
      this.registerRole(role);
    }
  }
  registerRole(role) {
    this.roles.set(role.name.toLowerCase(), {
      ...role,
      name: role.name.toLowerCase(),
      inherits: role.inherits?.map((r) => r.toLowerCase())
    });
  }
  registerRule(name, fn) {
    this.rules.set(name, fn);
  }
  /**
   * Resolves all permissions granted to a list of roles, including inherited roles.
   */
  resolveRolePermissions(roleNames) {
    const permissions = /* @__PURE__ */ new Set();
    const visitedRoles = /* @__PURE__ */ new Set();
    const traverse = (roleName) => {
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
  canUser(user, requiredPermission) {
    const directPerms = user.permissions || [];
    const rolePerms = user.roles ? this.resolveRolePermissions(user.roles) : [];
    const allPerms = [...directPerms, ...rolePerms];
    return hasPermission(allPerms, requiredPermission);
  }
  canUserAll(user, requiredPermissions) {
    const directPerms = user.permissions || [];
    const rolePerms = user.roles ? this.resolveRolePermissions(user.roles) : [];
    const allPerms = [...directPerms, ...rolePerms];
    return hasAllPermissions(allPerms, requiredPermissions);
  }
  canUserAny(user, requiredPermissions) {
    const directPerms = user.permissions || [];
    const rolePerms = user.roles ? this.resolveRolePermissions(user.roles) : [];
    const allPerms = [...directPerms, ...rolePerms];
    return hasAnyPermission(allPerms, requiredPermissions);
  }
  async evaluateRule(ruleName, context) {
    const rule = this.rules.get(ruleName);
    if (!rule) {
      throw new Error(`ABAC Rule '${ruleName}' is not registered`);
    }
    return Boolean(await rule(context));
  }
};

// src/prisma-adapter.ts
var PRISMA_RBAC_SCHEMA_SNIPPET = `
model Role {
  id          String           @id @default(uuid())
  name        String           @unique
  description String?
  permissions RolePermission[]
  users       UserRole[]
  createdAt   DateTime         @default(now())
}

model Permission {
  id          String           @id @default(uuid())
  action      String           @unique
  description String?
  roles       RolePermission[]
  createdAt   DateTime         @default(now())
}

model RolePermission {
  roleId       String
  permissionId String
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
}

model UserRole {
  userId    String
  roleId    String
  role      Role     @relation(fields: [roleId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@id([userId, roleId])
}
`;
var PrismaRbacAdapter = class {
  constructor(prisma) {
    this.prisma = prisma;
  }
  prisma;
  async getUserRoles(userId) {
    if (!this.prisma?.userRole) return [];
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    return userRoles.map((ur) => ur.role.name.toLowerCase());
  }
  async getUserPermissions(userId) {
    if (!this.prisma?.userRole) return [];
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: {
              include: { permission: true }
            }
          }
        }
      }
    });
    const perms = /* @__PURE__ */ new Set();
    for (const ur of userRoles) {
      if (ur.role && ur.role.permissions) {
        for (const rp of ur.role.permissions) {
          if (rp.permission?.action) {
            perms.add(rp.permission.action);
          }
        }
      }
    }
    return Array.from(perms);
  }
  async assignRole(userId, roleName) {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName.toLowerCase() }
    });
    if (!role) {
      throw new Error(`Role '${roleName}' does not exist`);
    }
    await this.prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId: role.id
        }
      },
      update: {},
      create: {
        userId,
        roleId: role.id
      }
    });
  }
  async revokeRole(userId, roleName) {
    const role = await this.prisma.role.findUnique({
      where: { name: roleName.toLowerCase() }
    });
    if (!role) return;
    await this.prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: role.id
      }
    });
  }
};

// src/express.ts
var defaultGetUser = (req) => {
  return req.user;
};
var RbacGuard = class {
  constructor(options) {
    this.options = options;
  }
  options;
  extractUser(req, res) {
    const getUser = this.options.getUser || defaultGetUser;
    const user = getUser(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required to check permissions"
        }
      });
      return null;
    }
    return user;
  }
  requirePermission(permission) {
    return (req, res, next) => {
      const user = this.extractUser(req, res);
      if (!user) return;
      const allowed = this.options.engine.canUser(user, permission);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `Permission denied. Required: '${permission}'`
          }
        });
        return;
      }
      next();
    };
  }
  requireAllPermissions(...permissions) {
    return (req, res, next) => {
      const user = this.extractUser(req, res);
      if (!user) return;
      const allowed = this.options.engine.canUserAll(user, permissions);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `Permission denied. Required all: [${permissions.join(", ")}]`
          }
        });
        return;
      }
      next();
    };
  }
  requireAnyPermission(...permissions) {
    return (req, res, next) => {
      const user = this.extractUser(req, res);
      if (!user) return;
      const allowed = this.options.engine.canUserAny(user, permissions);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `Permission denied. Requires one of: [${permissions.join(", ")}]`
          }
        });
        return;
      }
      next();
    };
  }
  requireRole(roleName) {
    return (req, res, next) => {
      const user = this.extractUser(req, res);
      if (!user) return;
      const roles = (user.roles || []).map((r) => r.toLowerCase());
      if (!roles.includes(roleName.toLowerCase())) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `Role denied. Required role: '${roleName}'`
          }
        });
        return;
      }
      next();
    };
  }
  requireAnyRole(...roleNames) {
    const lowerRoleNames = roleNames.map((r) => r.toLowerCase());
    return (req, res, next) => {
      const user = this.extractUser(req, res);
      if (!user) return;
      const userRoles = (user.roles || []).map((r) => r.toLowerCase());
      const hasAny = lowerRoleNames.some((r) => userRoles.includes(r));
      if (!hasAny) {
        res.status(403).json({
          success: false,
          error: {
            code: "FORBIDDEN",
            message: `Role denied. Requires one of roles: [${roleNames.join(", ")}]`
          }
        });
        return;
      }
      next();
    };
  }
  requireRule(rule, getResource) {
    return async (req, res, next) => {
      const user = this.extractUser(req, res);
      if (!user) return;
      const resource = getResource ? await getResource(req) : void 0;
      try {
        let allowed = false;
        if (typeof rule === "string") {
          allowed = await this.options.engine.evaluateRule(rule, { user, req, resource });
        } else {
          allowed = await rule({ user, req, resource });
        }
        if (!allowed) {
          res.status(403).json({
            success: false,
            error: {
              code: "FORBIDDEN",
              message: "Access policy check failed"
            }
          });
          return;
        }
        next();
      } catch (err) {
        res.status(500).json({
          success: false,
          error: {
            code: "POLICY_ERROR",
            message: err.message
          }
        });
      }
    };
  }
};
export {
  PRISMA_RBAC_SCHEMA_SNIPPET,
  PrismaRbacAdapter,
  RbacEngine,
  RbacGuard,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  matchPermission
};
