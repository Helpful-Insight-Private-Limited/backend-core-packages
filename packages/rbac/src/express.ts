import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RbacEngine } from './engine.js';
import { AbacRuleFn, RbacUser } from './types.js';

export interface RbacGuardOptions {
  engine: RbacEngine;
  getUser?: (req: Request) => RbacUser | undefined;
}

const defaultGetUser = (req: Request): RbacUser | undefined => {
  return (req as any).user;
};

export class RbacGuard {
  constructor(private options: RbacGuardOptions) {}

  private extractUser(req: Request, res: Response): RbacUser | null {
    const getUser = this.options.getUser || defaultGetUser;
    const user = getUser(req);
    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required to check permissions'
        }
      });
      return null;
    }
    return user;
  }

  requirePermission(permission: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = this.extractUser(req, res);
      if (!user) return;

      const allowed = this.options.engine.canUser(user, permission);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Permission denied. Required: '${permission}'`
          }
        });
        return;
      }

      next();
    };
  }

  requireAllPermissions(...permissions: string[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = this.extractUser(req, res);
      if (!user) return;

      const allowed = this.options.engine.canUserAll(user, permissions);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Permission denied. Required all: [${permissions.join(', ')}]`
          }
        });
        return;
      }

      next();
    };
  }

  requireAnyPermission(...permissions: string[]): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = this.extractUser(req, res);
      if (!user) return;

      const allowed = this.options.engine.canUserAny(user, permissions);
      if (!allowed) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Permission denied. Requires one of: [${permissions.join(', ')}]`
          }
        });
        return;
      }

      next();
    };
  }

  requireRole(roleName: string): RequestHandler {
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = this.extractUser(req, res);
      if (!user) return;

      const roles = (user.roles || []).map((r) => r.toLowerCase());
      if (!roles.includes(roleName.toLowerCase())) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Role denied. Required role: '${roleName}'`
          }
        });
        return;
      }

      next();
    };
  }

  requireAnyRole(...roleNames: string[]): RequestHandler {
    const lowerRoleNames = roleNames.map((r) => r.toLowerCase());
    return (req: Request, res: Response, next: NextFunction): void => {
      const user = this.extractUser(req, res);
      if (!user) return;

      const userRoles = (user.roles || []).map((r) => r.toLowerCase());
      const hasAny = lowerRoleNames.some((r) => userRoles.includes(r));
      if (!hasAny) {
        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: `Role denied. Requires one of roles: [${roleNames.join(', ')}]`
          }
        });
        return;
      }

      next();
    };
  }

  requireRule(
    rule: string | AbacRuleFn,
    getResource?: (req: Request) => any
  ): RequestHandler {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const user = this.extractUser(req, res);
      if (!user) return;

      const resource = getResource ? await getResource(req) : undefined;

      try {
        let allowed = false;
        if (typeof rule === 'string') {
          allowed = await this.options.engine.evaluateRule(rule, { user, req, resource });
        } else {
          allowed = await rule({ user, req, resource });
        }

        if (!allowed) {
          res.status(403).json({
            success: false,
            error: {
              code: 'FORBIDDEN',
              message: 'Access policy check failed'
            }
          });
          return;
        }

        next();
      } catch (err: any) {
        res.status(500).json({
          success: false,
          error: {
            code: 'POLICY_ERROR',
            message: err.message
          }
        });
      }
    };
  }
}
