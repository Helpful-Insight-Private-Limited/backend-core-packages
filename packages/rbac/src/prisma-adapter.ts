import { IRbacStore } from './types.js';

export const PRISMA_RBAC_SCHEMA_SNIPPET = `
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

export class PrismaRbacAdapter implements IRbacStore {
  constructor(private prisma: any) {}

  async getUserRoles(userId: string): Promise<string[]> {
    if (!this.prisma?.userRole) return [];
    const userRoles = await this.prisma.userRole.findMany({
      where: { userId },
      include: { role: true }
    });
    return userRoles.map((ur: any) => ur.role.name.toLowerCase());
  }

  async getUserPermissions(userId: string): Promise<string[]> {
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

    const perms = new Set<string>();
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

  async assignRole(userId: string, roleName: string): Promise<void> {
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

  async revokeRole(userId: string, roleName: string): Promise<void> {
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
}
