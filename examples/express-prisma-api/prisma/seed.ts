import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial RBAC roles, permissions, and admin account...');

  // 1. Create Permissions
  const permissions = [
    { action: '*', description: 'Full Superadmin wildcard' },
    { action: 'users:read', description: 'View user list and profiles' },
    { action: 'users:write', description: 'Create and update users' },
    { action: 'users:delete', description: 'Delete users' },
    { action: 'notifications:*', description: 'Manage notifications' },
    { action: 'templates:*', description: 'Manage email templates' }
  ];

  const createdPerms: Record<string, any> = {};
  for (const p of permissions) {
    const perm = await prisma.permission.upsert({
      where: { action: p.action },
      update: {},
      create: p
    });
    createdPerms[p.action] = perm;
  }

  // 2. Create Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: { name: 'admin', description: 'Administrator with full access' }
  });

  const viewerRole = await prisma.role.upsert({
    where: { name: 'viewer' },
    update: {},
    create: { name: 'viewer', description: 'Standard read-only user' }
  });

  // 3. Attach permissions to admin role
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: createdPerms['*'].id
      }
    },
    update: {},
    create: { roleId: adminRole.id, permissionId: createdPerms['*'].id }
  });

  // Attach users:read to viewer role
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: viewerRole.id,
        permissionId: createdPerms['users:read'].id
      }
    },
    update: {},
    create: { roleId: viewerRole.id, permissionId: createdPerms['users:read'].id }
  });

  // 4. Seed SuperAdmin user
  const adminEmail = 'admin@enterprise.com';
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('Admin@Pass123!', salt);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: 'Super Admin',
      passwordHash,
      isEmailVerified: true
    }
  });

  // Assign admin role to user
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: adminRole.id
      }
    },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id }
  });

  console.log('Seed completed successfully!');
  console.log('Admin Account: admin@enterprise.com / Admin@Pass123!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
