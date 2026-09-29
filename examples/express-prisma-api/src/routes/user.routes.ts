import { Router, Request, Response } from 'express';
import { prisma } from '../prisma.js';
import { authenticateJwt, rbacGuard, rbacAdapter } from '../services.js';

export const userRouter = Router();

// Protect all user routes with JWT authentication
userRouter.use(authenticateJwt());

// 1. GET CURRENT USER PROFILE
userRouter.get('/me', async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      language: true,
      isEmailVerified: true,
      isMfaEnabled: true,
      roles: { select: { role: { select: { name: true, description: true } } } },
      createdAt: true
    }
  });

  if (!user) {
    res.fail('NOT_FOUND', 'User profile not found', 404);
    return;
  }

  const permissions = await rbacAdapter.getUserPermissions(userId);

  res.ok({
    ...user,
    roles: user.roles.map((r: any) => r.role.name),
    permissions
  });
});

// 2. LIST ALL USERS (Protected by RBAC: 'users:read')
userRouter.get('/', rbacGuard.requirePermission('users:read'), async (req: Request, res: Response) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      isEmailVerified: true,
      roles: { select: { role: { select: { name: true } } } },
      createdAt: true
    },
    orderBy: { createdAt: 'desc' }
  });

  res.ok(
    users.map((u: any) => ({
      ...u,
      roles: u.roles.map((r: any) => r.role.name)
    })),
    { total: users.length }
  );
});

// 3. DELETE USER (Protected by RBAC: 'users:delete')
userRouter.delete(
  '/:id',
  rbacGuard.requirePermission('users:delete'),
  async (req: Request, res: Response) => {
    const targetId = req.params.id;

    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) {
      res.fail('NOT_FOUND', 'User not found', 404);
      return;
    }

    await prisma.user.delete({ where: { id: targetId } });

    if (req.audit) {
      await req.audit({
        action: 'USER_DELETED',
        resource: 'User',
        targetId,
        oldValues: { email: user.email }
      });
    }

    res.ok({ message: `User ${user.email} deleted successfully` });
  }
);

// 4. ASSIGN ROLE (Protected by RBAC: role 'admin')
userRouter.post(
  '/:id/role',
  rbacGuard.requireRole('admin'),
  async (req: Request, res: Response) => {
    const targetUserId = req.params.id;
    const { roleName } = req.body;

    if (!roleName) {
      res.fail('ROLE_REQUIRED', 'Role name is required', 400);
      return;
    }

    await rbacAdapter.assignRole(targetUserId, roleName);

    if (req.audit) {
      await req.audit({
        action: 'ROLE_ASSIGNED',
        resource: 'UserRole',
        targetId: targetUserId,
        newValues: { role: roleName }
      });
    }

    res.ok({ message: `Role '${roleName}' assigned to user successfully` });
  }
);
