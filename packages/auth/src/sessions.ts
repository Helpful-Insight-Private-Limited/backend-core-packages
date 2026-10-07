export interface StoredRefreshToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  isRevoked: boolean;
  deviceInfo?: string;
  createdAt: Date;
}

export interface ISessionStore {
  saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    deviceInfo?: string
  ): Promise<StoredRefreshToken>;
  findRefreshToken(token: string): Promise<StoredRefreshToken | null>;
  rotateRefreshToken(
    oldToken: string,
    newToken: string,
    newExpiresAt: Date
  ): Promise<StoredRefreshToken | null>;
  revokeRefreshToken(token: string): Promise<boolean>;
  revokeAllUserSessions(userId: string): Promise<number>;
}

export class MemorySessionStore implements ISessionStore {
  private tokens: Map<string, StoredRefreshToken> = new Map();

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    deviceInfo?: string
  ): Promise<StoredRefreshToken> {
    const item: StoredRefreshToken = {
      id: Math.random().toString(36).substring(2, 10),
      token,
      userId,
      expiresAt,
      isRevoked: false,
      deviceInfo,
      createdAt: new Date()
    };
    this.tokens.set(token, item);
    return item;
  }

  async findRefreshToken(token: string): Promise<StoredRefreshToken | null> {
    const item = this.tokens.get(token);
    if (!item) return null;
    if (item.isRevoked || item.expiresAt < new Date()) {
      return null;
    }
    return { ...item };
  }

  async rotateRefreshToken(
    oldToken: string,
    newToken: string,
    newExpiresAt: Date
  ): Promise<StoredRefreshToken | null> {
    const existing = this.tokens.get(oldToken);
    if (!existing || existing.isRevoked) {
      // Possible token replay attack! Revoke all tokens for this user!
      if (existing) {
        await this.revokeAllUserSessions(existing.userId);
      }
      return null;
    }

    // Revoke old token
    existing.isRevoked = true;
    this.tokens.set(oldToken, existing);

    // Issue new token
    return this.saveRefreshToken(existing.userId, newToken, newExpiresAt, existing.deviceInfo);
  }

  async revokeRefreshToken(token: string): Promise<boolean> {
    const item = this.tokens.get(token);
    if (item) {
      item.isRevoked = true;
      return true;
    }
    return false;
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    let count = 0;
    for (const [key, val] of this.tokens.entries()) {
      if (val.userId === userId && !val.isRevoked) {
        val.isRevoked = true;
        count++;
      }
    }
    return count;
  }
}

export class PrismaSessionStore implements ISessionStore {
  constructor(private prisma: any) {}

  async saveRefreshToken(
    userId: string,
    token: string,
    expiresAt: Date,
    deviceInfo?: string
  ): Promise<StoredRefreshToken> {
    if (!this.prisma?.refreshToken) {
      throw new Error('Prisma client does not have refreshToken model');
    }
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        deviceInfo
      }
    });
    return record;
  }

  async findRefreshToken(token: string): Promise<StoredRefreshToken | null> {
    if (!this.prisma?.refreshToken) return null;
    return this.prisma.refreshToken.findUnique({
      where: { token }
    });
  }

  async rotateRefreshToken(
    oldToken: string,
    newToken: string,
    newExpiresAt: Date
  ): Promise<StoredRefreshToken | null> {
    if (!this.prisma?.refreshToken) return null;

    // Atomic conditional update to eliminate TOCTOU concurrency race conditions
    const updateRes = await this.prisma.refreshToken.updateMany({
      where: {
        token: oldToken,
        isRevoked: false,
        expiresAt: { gt: new Date() }
      },
      data: { isRevoked: true }
    });

    if (updateRes.count === 0) {
      // Replay attack or already rotated: revoke all user sessions if record existed
      const existing = await this.prisma.refreshToken.findUnique({
        where: { token: oldToken }
      });
      if (existing) {
        await this.revokeAllUserSessions(existing.userId);
      }
      return null;
    }

    const existing = await this.prisma.refreshToken.findUnique({
      where: { token: oldToken }
    });

    // Create new token
    return this.saveRefreshToken(existing.userId, newToken, newExpiresAt, existing?.deviceInfo);
  }

  async revokeRefreshToken(token: string): Promise<boolean> {
    if (!this.prisma?.refreshToken) return false;
    try {
      await this.prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true }
      });
      return true;
    } catch {
      return false;
    }
  }

  async revokeAllUserSessions(userId: string): Promise<number> {
    if (!this.prisma?.refreshToken) return 0;
    const res = await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
    return res.count;
  }
}
