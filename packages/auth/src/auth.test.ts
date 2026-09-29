import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PasswordHash } from './password.js';
import { JwtService } from './jwt.js';
import { TotpService } from './totp.js';
import { MemorySessionStore } from './sessions.js';
import { MemoryAuthUserStore } from './user-store.js';
import { createAuthRouter } from './router.js';

describe('@core/auth', () => {
  describe('PasswordHash', () => {
    it('should hash and verify passwords', async () => {
      const password = 'SuperSecretPassword!123';
      const hash = await PasswordHash.hash(password, 6); // low rounds for fast test
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);

      const isValid = await PasswordHash.compare(password, hash);
      expect(isValid).toBe(true);

      const isInvalid = await PasswordHash.compare('wrong-password', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('JwtService', () => {
    const jwtService = new JwtService({
      accessSecret: 'test-access-secret-32-chars-long-at-least!',
      refreshSecret: 'test-refresh-secret-32-chars-long-at-least!'
    });

    it('should issue and verify access token', () => {
      const token = jwtService.generateAccessToken({
        sub: 'user_123',
        email: 'user@example.com',
        roles: ['admin']
      });

      const payload = jwtService.verifyAccessToken(token);
      expect(payload.sub).toBe('user_123');
      expect(payload.email).toBe('user@example.com');
      expect(payload.roles).toEqual(['admin']);
    });
  });

  describe('TotpService', () => {
    it('should generate secret, compute token, and verify it', () => {
      const secret = TotpService.generateSecret();
      expect(secret.length).toBeGreaterThan(15);

      const token = TotpService.generateToken(secret);
      expect(token).toHaveLength(6);

      const isValid = TotpService.verifyToken(token, secret);
      expect(isValid).toBe(true);

      const isInvalid = TotpService.verifyToken('000000', secret);
      expect(isInvalid).toBe(false);
    });

    it('should generate backup codes', () => {
      const codes = TotpService.generateBackupCodes(8);
      expect(codes).toHaveLength(8);
      expect(codes[0]).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}$/);
    });
  });

  describe('SessionStore', () => {
    it('should support refresh token rotation', async () => {
      const store = new MemorySessionStore();
      const expiresAt = new Date(Date.now() + 3600000);

      const token1 = 'token_v1';
      await store.saveRefreshToken('u1', token1, expiresAt);

      const token2 = 'token_v2';
      const rotated = await store.rotateRefreshToken(token1, token2, expiresAt);
      expect(rotated?.token).toBe(token2);

      // Old token should now be revoked
      const oldFound = await store.findRefreshToken(token1);
      expect(oldFound).toBeNull(); // revoked tokens return null

      // Trying to rotate the already-revoked token should trigger replay protection
      const replayAttempt = await store.rotateRefreshToken(token1, 'token_v3', expiresAt);
      expect(replayAttempt).toBeNull();
    });
  });

  describe('createAuthRouter (Login, Signup, Forget, Reset Password APIs)', () => {
    const userStore = new MemoryAuthUserStore();
    const sessionStore = new MemorySessionStore();
    const jwtService = new JwtService({
      accessSecret: 'test-access-secret-32-chars-long-at-least!',
      refreshSecret: 'test-refresh-secret-32-chars-long-at-least!'
    });

    let lastSentResetMail: any = null;

    const authRouter = createAuthRouter({
      userStore,
      sessionStore,
      jwtService,
      onSendPasswordResetMail: async (opts) => {
        lastSentResetMail = opts;
      }
    });

    const app = express();
    app.use(express.json());
    app.use('/auth', authRouter);

    let resetToken = '';

    it('1. POST /signup - should register a new user', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          email: 'alice@example.com',
          password: 'Password123!',
          name: 'Alice Johnson'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alice@example.com');
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('2. POST /login - should authenticate valid user', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'Password123!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tokens.accessToken).toBeDefined();
    });

    it('3. POST /forgot-password - should trigger password reset token and mail hook', async () => {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'alice@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(lastSentResetMail).toBeDefined();
      expect(lastSentResetMail.to).toBe('alice@example.com');
      expect(lastSentResetMail.resetToken).toBeDefined();
      resetToken = lastSentResetMail.resetToken;
    });

    it('4. POST /reset-password - should reset password with valid token', async () => {
      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: 'BrandNewSecurePassword456!'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify login works with new password
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'BrandNewSecurePassword456!'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.success).toBe(true);

      // Verify old password fails
      const oldLoginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'Password123!'
        });

      expect(oldLoginRes.status).toBe(401);
    });

    it('5. POST /forget alias should also work', async () => {
      const res = await request(app)
        .post('/auth/forget')
        .send({ email: 'alice@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
