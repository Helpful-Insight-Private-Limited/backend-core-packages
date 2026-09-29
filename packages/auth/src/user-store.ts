export interface AuthUser {
  id: string;
  email: string;
  passwordHash?: string | null;
  name?: string | null;
  phone?: string | null;
  roles?: string[];
  isMfaEnabled?: boolean;
  mfaSecret?: string | null;
  mfaBackupCodes?: string | null;
  [key: string]: any;
}

export interface IAuthUserStore {
  findByEmail(email: string): Promise<AuthUser | null>;
  findById(id: string): Promise<AuthUser | null>;
  create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    phone?: string;
    role?: string;
  }): Promise<AuthUser>;
  updatePassword(userId: string, newPasswordHash: string): Promise<void>;
  updateMfa(
    userId: string,
    data: {
      isMfaEnabled?: boolean;
      mfaSecret?: string | null;
      mfaBackupCodes?: string | null;
    }
  ): Promise<void>;
}

export class MemoryAuthUserStore implements IAuthUserStore {
  private users: Map<string, AuthUser> = new Map();

  async findByEmail(email: string): Promise<AuthUser | null> {
    const lower = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === lower) return { ...u };
    }
    return null;
  }

  async findById(id: string): Promise<AuthUser | null> {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    phone?: string;
    role?: string;
  }): Promise<AuthUser> {
    const id = `usr_${Math.random().toString(36).substring(2, 10)}`;
    const user: AuthUser = {
      id,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      phone: data.phone,
      roles: data.role ? [data.role] : ['viewer'],
      isMfaEnabled: false
    };
    this.users.set(id, user);
    return { ...user };
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      u.passwordHash = newPasswordHash;
    }
  }

  async updateMfa(
    userId: string,
    data: {
      isMfaEnabled?: boolean;
      mfaSecret?: string | null;
      mfaBackupCodes?: string | null;
    }
  ): Promise<void> {
    const u = this.users.get(userId);
    if (u) {
      if (data.isMfaEnabled !== undefined) u.isMfaEnabled = data.isMfaEnabled;
      if (data.mfaSecret !== undefined) u.mfaSecret = data.mfaSecret;
      if (data.mfaBackupCodes !== undefined) u.mfaBackupCodes = data.mfaBackupCodes;
    }
  }
}

export class PrismaAuthUserStore implements IAuthUserStore {
  constructor(private prisma: any) {}

  async findByEmail(email: string): Promise<AuthUser | null> {
    if (!this.prisma?.user) return null;
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: { include: { role: true } } }
    });
    if (!row) return null;
    return this.mapPrismaUser(row);
  }

  async findById(id: string): Promise<AuthUser | null> {
    if (!this.prisma?.user) return null;
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } }
    });
    if (!row) return null;
    return this.mapPrismaUser(row);
  }

  async create(data: {
    email: string;
    passwordHash: string;
    name?: string;
    phone?: string;
    role?: string;
  }): Promise<AuthUser> {
    if (!this.prisma?.user) throw new Error('Prisma user model is missing');

    const roleName = data.role || 'viewer';

    // Ensure role exists
    let role = await this.prisma.role?.findUnique({ where: { name: roleName } });
    if (!role && this.prisma.role) {
      role = await this.prisma.role.create({
        data: { name: roleName, description: `${roleName} role` }
      });
    }

    const row = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
        phone: data.phone,
        ...(role
          ? {
              roles: {
                create: { roleId: role.id }
              }
            }
          : {})
      },
      include: { roles: { include: { role: true } } }
    });

    return this.mapPrismaUser(row);
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    if (!this.prisma?.user) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });
  }

  async updateMfa(
    userId: string,
    data: {
      isMfaEnabled?: boolean;
      mfaSecret?: string | null;
      mfaBackupCodes?: string | null;
    }
  ): Promise<void> {
    if (!this.prisma?.user) return;
    await this.prisma.user.update({
      where: { id: userId },
      data
    });
  }

  private mapPrismaUser(row: any): AuthUser {
    const roles: string[] = Array.isArray(row.roles)
      ? row.roles.map((r: any) => r.role?.name || r.roleName || '').filter(Boolean)
      : [];

    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      phone: row.phone,
      roles,
      isMfaEnabled: row.isMfaEnabled,
      mfaSecret: row.mfaSecret,
      mfaBackupCodes: row.mfaBackupCodes
    };
  }
}
