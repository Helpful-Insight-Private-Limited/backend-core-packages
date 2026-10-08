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

    it('1b. POST /signup - should reject malformed emails like test@@example.com and rohit60!!@example.com', async () => {
      const doubleAtRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'test@@example.com',
          password: 'Password123!'
        });
      expect(doubleAtRes.status).toBe(400);
      expect(doubleAtRes.body.success).toBe(false);
      expect(doubleAtRes.body.error.code).toBe('INVALID_EMAIL');

      const doubleExclamationRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'rohit60!!@example.com',
          password: 'Password123!'
        });
      expect(doubleExclamationRes.status).toBe(400);
      expect(doubleExclamationRes.body.success).toBe(false);
      expect(doubleExclamationRes.body.error.code).toBe('INVALID_EMAIL');
    });

    it('1c. POST /signup - should reject weak passwords with repetitive chars or missing complexity', async () => {
      // Repetitive symbols
      const plusRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'user_valid1@example.com',
          password: '++++++++++++++++'
        });
      expect(plusRes.status).toBe(400);
      expect(plusRes.body.success).toBe(false);
      expect(plusRes.body.error.code).toBe('WEAK_PASSWORD');

      // Only numbers
      const numRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'user_valid2@example.com',
          password: '28268888'
        });
      expect(numRes.status).toBe(400);
      expect(numRes.body.success).toBe(false);
      expect(numRes.body.error.code).toBe('WEAK_PASSWORD');
    });

    it('1d. POST /signup - should reject dummy and invalid phone numbers', async () => {
      const dummyPhoneRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'user_valid3@example.com',
          password: 'Password123!',
          phone: '+911111111111'
        });
      expect(dummyPhoneRes.status).toBe(400);
      expect(dummyPhoneRes.body.success).toBe(false);
      expect(dummyPhoneRes.body.error.code).toBe('INVALID_PHONE');

      const repeatPhoneRes = await request(app)
        .post('/auth/signup')
        .send({
          email: 'user_valid4@example.com',
          password: 'Password123!',
          phone: '+919999999999'
        });
      expect(repeatPhoneRes.status).toBe(400);
      expect(repeatPhoneRes.body.success).toBe(false);
      expect(repeatPhoneRes.body.error.code).toBe('INVALID_PHONE');
    });

    it('1e. POST /signup - should reject repetitive and dummy email formats', async () => {
      const emailsToReject = [
        '000000000000+0@example.com',
        '0-------------------00000000000+0@example.com',
        '010101010101@example.com',
        '!!!01789076643@example.com',
        'pppppppppppppppppppppppppppppppppppppppppp++++++++++++++++++++++@example.com'
      ];

      for (const email of emailsToReject) {
        const res = await request(app)
          .post('/auth/signup')
          .send({
            email,
            password: 'Password123!'
          });
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error.code).toBe('INVALID_EMAIL');
      }
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

    it('4a. POST /reset-password - should reject weak or repetitive passwords', async () => {
      const weakRes = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: '++++++++++++++++'
        });
      expect(weakRes.status).toBe(400);
      expect(weakRes.body.success).toBe(false);
      expect(weakRes.body.error.code).toBe('WEAK_PASSWORD');

      const digitsRes = await request(app)
        .post('/auth/reset-password')
        .send({
          token: resetToken,
          newPassword: '28268888'
        });
      expect(digitsRes.status).toBe(400);
      expect(digitsRes.body.success).toBe(false);
      expect(digitsRes.body.error.code).toBe('WEAK_PASSWORD');
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

    it('6. POST /signup - should prevent mass assignment privilege escalation (CWE-915)', async () => {
      const res = await request(app)
        .post('/auth/signup')
        .send({
          email: 'attacker@example.com',
          password: 'Password123!',
          role: 'admin' // Attempting privilege escalation
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      // Role must be the default viewer role, NEVER admin!
      expect(res.body.data.user.roles).toEqual(['viewer']);
      expect(res.body.data.user.roles).not.toContain('admin');
    });

    it('7. Protected route - should reject password reset token as access token', async () => {
      const { createAuthMiddleware } = await import('./express.js');
      const jwtLib = (await import('jsonwebtoken')).default;
      const { authenticateJwt } = createAuthMiddleware(jwtService);

      const protectedApp = express();
      protectedApp.use(express.json());
      protectedApp.get('/profile', authenticateJwt(), (req, res) => {
        res.json({ success: true, user: req.user });
      });

      // 7a. Dedicated reset token (signed with resetSecret)
      const resetToken = jwtService.generateResetToken({
        sub: 'user_123',
        email: 'user@example.com'
      });

      const res = await request(protectedApp)
        .get('/profile')
        .set('Authorization', `Bearer ${resetToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);

      // 7b. Token signed with access secret but having purpose: 'password_reset'
      const tokenWithResetPurpose = jwtLib.sign(
        { sub: 'user_123', email: 'user@example.com', purpose: 'password_reset' },
        'test-access-secret-32-chars-long-at-least!'
      );
      const res2 = await request(protectedApp)
        .get('/profile')
        .set('Authorization', `Bearer ${tokenWithResetPurpose}`);

      expect(res2.status).toBe(401);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error.code).toBe('INVALID_TOKEN_PURPOSE');
    });

    it('8. GET /auth/me - should return user profile with valid access token', async () => {
      // First login alice
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'BrandNewSecurePassword456!'
        });

      const accessToken = loginRes.body.data.tokens.accessToken;
      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.email).toBe('alice@example.com');
      expect(meRes.body.data.roles).toEqual(['viewer']);
    });

    it('9. POST /auth/refresh - should rotate refresh token and issue new pair', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'BrandNewSecurePassword456!'
        });

      const oldRefreshToken = loginRes.body.data.tokens.refreshToken;

      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.tokens.accessToken).toBeDefined();
      expect(refreshRes.body.data.tokens.refreshToken).toBeDefined();

      // Attempt to replay the old refresh token
      const replayRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: oldRefreshToken });

      expect(replayRes.status).toBe(403);
      expect(replayRes.body.success).toBe(false);
      expect(replayRes.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('10. POST /auth/logout - should revoke refresh token', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'BrandNewSecurePassword456!'
        });

      const refreshToken = loginRes.body.data.tokens.refreshToken;

      const logoutRes = await request(app)
        .post('/auth/logout')
        .send({ refreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);

      // Attempting to refresh with the logged out token should fail
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken });

      expect(refreshRes.status).toBe(403);
    });

    it('11. MFA Setup & Verify - should enable 2FA on valid TOTP code', async () => {
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'BrandNewSecurePassword456!'
        });

      const accessToken = loginRes.body.data.tokens.accessToken;

      // 1. Setup MFA
      const setupRes = await request(app)
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(setupRes.status).toBe(200);
      expect(setupRes.body.success).toBe(true);
      expect(setupRes.body.data.secret).toBeDefined();
      expect(setupRes.body.data.backupCodes).toHaveLength(8);

      const secret = setupRes.body.data.secret;
      const validCode = TotpService.generateToken(secret);

      // 2. Verify MFA with valid code
      const verifyRes = await request(app)
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ token: validCode });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      // 3. Check /me reflects MFA enabled
      const meRes = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(meRes.body.data.isMfaEnabled).toBe(true);
    });

    it('12. Security: Pre-MFA tempToken CANNOT be laundered into full token pair via /refresh (Single-Secret Setup)', async () => {
      // Create a single-secret router (default configuration where accessSecret == refreshSecret)
      const singleSecretJwt = new JwtService({
        accessSecret: 'single-shared-secret-for-both-access-and-refresh!'
      });
      const singleSecretUserStore = new MemoryAuthUserStore();
      const singleSecretSessionStore = new MemorySessionStore();

      const singleSecretRouter = createAuthRouter({
        userStore: singleSecretUserStore,
        sessionStore: singleSecretSessionStore,
        jwtService: singleSecretJwt
      });

      const singleApp = express();
      singleApp.use(express.json());
      singleApp.use('/auth', singleSecretRouter);

      // 1. Register user
      await request(singleApp)
        .post('/auth/signup')
        .send({
          email: 'bob@example.com',
          password: 'Password123!',
          name: 'Bob'
        });

      // 2. Enable MFA for Bob
      const loginRes = await request(singleApp)
        .post('/auth/login')
        .send({ email: 'bob@example.com', password: 'Password123!' });

      const bobToken = loginRes.body.data.tokens.accessToken;
      const setupRes = await request(singleApp)
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${bobToken}`);

      const secret = setupRes.body.data.secret;
      const validCode = TotpService.generateToken(secret);

      await request(singleApp)
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${bobToken}`)
        .send({ token: validCode });

      // 3. Attacker with only password logs in
      const preMfaLoginRes = await request(singleApp)
        .post('/auth/login')
        .send({ email: 'bob@example.com', password: 'Password123!' });

      expect(preMfaLoginRes.status).toBe(200);
      expect(preMfaLoginRes.body.data.mfaRequired).toBe(true);
      const tempToken = preMfaLoginRes.body.data.tempToken;
      expect(tempToken).toBeDefined();

      // 4. Attacker attempts to submit tempToken to /refresh to bypass MFA
      const exploitRes = await request(singleApp)
        .post('/auth/refresh')
        .send({ refreshToken: tempToken });

      // Must be rejected with 401 because tempToken has purpose: 'access', NOT 'refresh'
      expect(exploitRes.status).toBe(401);
      expect(exploitRes.body.success).toBe(false);
      expect(exploitRes.body.error.code).toBe('REFRESH_FAILED');
    });

    it('13. Security: /refresh rejects refresh token if isMfaVerified is false for MFA-enabled user', async () => {
      const testStore = new MemoryAuthUserStore();
      const createdUser = await testStore.create({
        email: 'alice_mfa@example.com',
        passwordHash: 'dummyhash'
      });
      await testStore.updateMfa(createdUser.id, { isMfaEnabled: true });

      // Manually forge a token that has purpose: 'refresh' but isMfaVerified: false
      const unverifiedRefreshToken = jwtService.generateRefreshToken({
        sub: createdUser.id,
        sessionId: 'sess_1',
        isMfaVerified: false
      });

      const testRouter = createAuthRouter({
        userStore: testStore,
        jwtService
      });

      const testApp = express();
      testApp.use(express.json());
      testApp.use('/auth', testRouter);

      const res = await request(testApp)
        .post('/auth/refresh')
        .send({ refreshToken: unverifiedRefreshToken });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('MFA_REQUIRED');
    });

    it('14. Security: Refresh token CANNOT be used as access token on protected routes', async () => {
      const { createAuthMiddleware } = await import('./express.js');

      // Test with single-secret configuration (where signature is valid for both access and refresh)
      const singleSecretJwt = new JwtService({
        accessSecret: 'shared-secret-key-32-chars-long-at-least!'
      });
      const { authenticateJwt } = createAuthMiddleware(singleSecretJwt);

      const protectedApp = express();
      protectedApp.use(express.json());
      protectedApp.get('/protected', authenticateJwt(), (req, res) => {
        res.json({ success: true, user: req.user });
      });

      const refreshToken = singleSecretJwt.generateRefreshToken({
        sub: 'user_123',
        sessionId: 'sess_abc'
      });

      const res = await request(protectedApp)
        .get('/protected')
        .set('Authorization', `Bearer ${refreshToken}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_TOKEN_PURPOSE');
    });

    it('15. MFA: Legitimate user can complete login via /mfa/verify and refresh tokens safely', async () => {
      // 1. Alice logs in (MFA is enabled from test 11)
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'BrandNewSecurePassword456!'
        });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body.data.mfaRequired).toBe(true);
      const tempToken = loginRes.body.data.tempToken;

      const user = await userStore.findByEmail('alice@example.com');
      const totpCode = TotpService.generateToken(user!.mfaSecret!);

      // 2. Submit TOTP to /mfa/verify
      const verifyRes = await request(app)
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ token: totpCode });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);
      expect(verifyRes.body.data.tokens.accessToken).toBeDefined();
      expect(verifyRes.body.data.tokens.refreshToken).toBeDefined();

      const legitRefreshToken = verifyRes.body.data.tokens.refreshToken;

      // 3. /refresh with legitimate token succeeds
      const refreshRes = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: legitRefreshToken });

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.success).toBe(true);
      expect(refreshRes.body.data.tokens.accessToken).toBeDefined();
    });

    it('16. MFA: User can log in directly by passing totpCode in /login', async () => {
      const user = await userStore.findByEmail('alice@example.com');
      const totpCode = TotpService.generateToken(user!.mfaSecret!);

      const directLoginRes = await request(app)
        .post('/auth/login')
        .send({
          email: 'alice@example.com',
          password: 'BrandNewSecurePassword456!',
          totpCode
        });

      expect(directLoginRes.status).toBe(200);
      expect(directLoginRes.body.success).toBe(true);
      expect(directLoginRes.body.data.tokens.accessToken).toBeDefined();
    });

    it('17. Security (BUG-01): Pre-MFA tempToken CANNOT access /mfa/setup to hijack MFA secret', async () => {
      // Bob logs in and gets pre-MFA tempToken
      const preMfaRes = await request(app)
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'BrandNewSecurePassword456!' });

      const tempToken = preMfaRes.body.data.tempToken;

      // Attacker tries to call /mfa/setup using the pre-MFA tempToken
      const setupHijackRes = await request(app)
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${tempToken}`);

      // Must be rejected because tempToken has purpose 'mfa_pending', not 'access'
      expect(setupHijackRes.status).toBe(401);
      expect(setupHijackRes.body.success).toBe(false);
      expect(setupHijackRes.body.error.code).toBe('INVALID_TOKEN_PURPOSE');
    });

    it('18. Security (BUG-02): Password reset token CANNOT be replayed after password has been changed', async () => {
      // 1. Request reset token
      await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'alice@example.com' });

      const tokenToReplay = lastSentResetMail.resetToken;
      expect(tokenToReplay).toBeDefined();

      // 2. First reset - should succeed
      const firstResetRes = await request(app)
        .post('/auth/reset-password')
        .send({
          token: tokenToReplay,
          newPassword: 'SecondPassword789!'
        });

      expect(firstResetRes.status).toBe(200);
      expect(firstResetRes.body.success).toBe(true);

      // 3. Replay attack - try to reset AGAIN with the same token
      const replayResetRes = await request(app)
        .post('/auth/reset-password')
        .send({
          token: tokenToReplay,
          newPassword: 'AttackerHijackedPassword999!'
        });

      // Must be rejected because token was bound to the old passwordHash
      expect(replayResetRes.status).toBe(400);
      expect(replayResetRes.body.success).toBe(false);
      expect(replayResetRes.body.error.code).toBe('RESET_TOKEN_USED');
    });

    it('19. Security (BUG-03): /forgot-password does NOT leak debug resetToken in response by default', async () => {
      const res = await request(app)
        .post('/auth/forgot-password')
        .send({ email: 'alice@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.debug).toBeUndefined();
    });

    it('20. Security (BUG-04): Excessive failed MFA attempts trigger rate-limit lockout (429)', async () => {
      const preMfaRes = await request(app)
        .post('/auth/login')
        .send({ email: 'alice@example.com', password: 'SecondPassword789!' });

      const tempToken = preMfaRes.body.data.tempToken;

      // Send 5 invalid attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/auth/mfa/verify')
          .set('Authorization', `Bearer ${tempToken}`)
          .send({ token: '000000' });
      }

      // 6th attempt should be blocked with 429 TOO_MANY_ATTEMPTS
      const blockedRes = await request(app)
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${tempToken}`)
        .send({ token: '000000' });

      expect(blockedRes.status).toBe(429);
      expect(blockedRes.body.success).toBe(false);
      expect(blockedRes.body.error.code).toBe('TOO_MANY_ATTEMPTS');
    });

    it('21. Security (BUG-06): Emergency backup codes are hashed in DB and single-use', async () => {
      const testStore = new MemoryAuthUserStore();
      const testRouter = createAuthRouter({
        userStore: testStore,
        jwtService
      });

      const testApp = express();
      testApp.use(express.json());
      testApp.use('/auth', testRouter);

      // Register and login
      const signupRes = await request(testApp)
        .post('/auth/signup')
        .send({ email: 'backup_test@example.com', password: 'Password123!' });

      const token = signupRes.body.data.tokens.accessToken;

      // Setup MFA
      const setupRes = await request(testApp)
        .post('/auth/mfa/setup')
        .set('Authorization', `Bearer ${token}`);

      const backupCodes = setupRes.body.data.backupCodes;
      expect(backupCodes).toHaveLength(8);

      // Verify backup codes stored in DB are HASHED (not plaintext)
      const user = await testStore.findByEmail('backup_test@example.com');
      const storedHashedCodes = JSON.parse(user!.mfaBackupCodes!);
      expect(storedHashedCodes[0]).not.toBe(backupCodes[0]);
      expect(storedHashedCodes[0]).toHaveLength(64); // SHA-256 hex string

      // Verify using first backup code
      const verifyRes = await request(testApp)
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: backupCodes[0] });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.success).toBe(true);

      // Verify that used backup code was consumed (remaining is 7)
      const updatedUser = await testStore.findByEmail('backup_test@example.com');
      const remainingCodes = JSON.parse(updatedUser!.mfaBackupCodes!);
      expect(remainingCodes).toHaveLength(7);

      // Attempting to reuse the exact same backup code must fail
      const reuseRes = await request(testApp)
        .post('/auth/mfa/verify')
        .set('Authorization', `Bearer ${token}`)
        .send({ token: backupCodes[0] });

      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error.code).toBe('INVALID_MFA_TOKEN');
    });

    it('22. Security (BUG-07): OAuth helpers reject unverified emails', async () => {
      const { GoogleOAuthHelper } = await import('./oauth.js');
      const google = new GoogleOAuthHelper('client_id', 'client_secret', 'http://localhost/callback');

      // Mock fetch returning unverified email
      const originalFetch = global.fetch;
      try {
        global.fetch = async (url: any) => {
          if (String(url).includes('oauth2.googleapis.com/token')) {
            return { ok: true, json: async () => ({ access_token: 'fake_token' }) } as any;
          }
          if (String(url).includes('googleapis.com/oauth2/v3/userinfo')) {
            return {
              ok: true,
              json: async () => ({ sub: '123', email: 'attacker@gmail.com', email_verified: false })
            } as any;
          }
          return { ok: false, text: async () => 'err' } as any;
        };

        await expect(google.exchangeCode('test_code')).rejects.toThrow('Google account email is not verified');
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});

