import { Router, Request, Response } from 'express';
import { PasswordHash } from './password.js';
import { JwtService } from './jwt.js';
import { TotpService } from './totp.js';
import { ISessionStore } from './sessions.js';
import { IAuthUserStore, PrismaAuthUserStore, MemoryAuthUserStore } from './user-store.js';
import { createAuthMiddleware } from './express.js';
import { EmailValidator, PhoneValidator } from '@rohit-jain11/validator';

export interface SendMailHookOptions {
  to: string;
  subject: string;
  resetUrl: string;
  resetToken: string;
  userName?: string;
}

export interface AuthRouterOptions {
  prisma?: any;
  userStore?: IAuthUserStore;
  jwtService: JwtService;
  sessionStore?: ISessionStore;
  onSendPasswordResetMail?: (options: SendMailHookOptions) => Promise<void>;
  resetPasswordUrl?: string; // Default: 'http://localhost:3000/reset-password'
  resetTokenExpiresIn?: string | number; // Default: '15m'
  defaultRole?: string; // Default: 'viewer'
  jwtResetSecret?: string;
  onUserRegistered?: (user: any, req: Request) => Promise<void> | void;
  onUserLoggedIn?: (user: any, req: Request) => Promise<void> | void;
  onPasswordReset?: (user: any, req: Request) => Promise<void> | void;
  exposeResetTokenInResponse?: boolean;
  maxMfaAttempts?: number;
  mfaLockoutMs?: number;
}

export function createAuthRouter(options: AuthRouterOptions): Router {
  const router = Router();

  // Resolve user store: explicitly passed > Prisma instance > Memory fallback
  const store: IAuthUserStore =
    options.userStore ||
    (options.prisma ? new PrismaAuthUserStore(options.prisma) : new MemoryAuthUserStore());

  const jwt = options.jwtService;
  const session = options.sessionStore;
  const defaultRole = options.defaultRole || 'viewer';
  const resetUrlBase = options.resetPasswordUrl || 'http://localhost:3000/reset-password';
  const resetTokenExpires = options.resetTokenExpiresIn || '15m';

  const { authenticateJwt, requireMfaVerification } = createAuthMiddleware(jwt);

  // In-memory rate limiting and lockout for MFA verification attempts
  const mfaAttemptTracker = new Map<string, { attempts: number; lockedUntil?: number }>();
  const maxMfaAttempts = options.maxMfaAttempts || 5;
  const mfaLockoutMs = options.mfaLockoutMs || 5 * 60 * 1000;

  const checkMfaRateLimit = (key: string): boolean => {
    const entry = mfaAttemptTracker.get(key);
    if (!entry) return true;
    if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
      return false;
    }
    if (entry.lockedUntil && entry.lockedUntil <= Date.now()) {
      mfaAttemptTracker.delete(key);
      return true;
    }
    return true;
  };

  const recordMfaFailure = (key: string): { locked: boolean } => {
    let entry = mfaAttemptTracker.get(key);
    if (!entry || (entry.lockedUntil && entry.lockedUntil <= Date.now())) {
      entry = { attempts: 0 };
    }
    entry.attempts++;
    if (entry.attempts >= maxMfaAttempts) {
      entry.lockedUntil = Date.now() + mfaLockoutMs;
      mfaAttemptTracker.set(key, entry);
      return { locked: true };
    }
    mfaAttemptTracker.set(key, entry);
    return { locked: false };
  };

  const clearMfaAttempts = (key: string) => {
    mfaAttemptTracker.delete(key);
  };

  // Helper response
  const sendSuccess = (res: Response, data: any, statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });
  };

  const sendError = (res: Response, code: string, message: string, statusCode = 400) => {
    res.status(statusCode).json({
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString()
    });
  };

  // -------------------------------------------------------------
  // 1. SIGNUP / REGISTER
  // -------------------------------------------------------------
  const handleSignup = async (req: Request, res: Response) => {
    try {
      const { email, password, name, phone } = req.body;

      if (!email || typeof email !== 'string') {
        return sendError(res, 'INVALID_EMAIL', 'A valid email address is required', 400);
      }

      const emailValidation = EmailValidator.validate(email);
      if (!emailValidation.isValid) {
        return sendError(res, 'INVALID_EMAIL', emailValidation.error || 'A valid email address is required', 400);
      }

      if (phone) {
        const phoneValidation = PhoneValidator.validate(String(phone));
        if (!phoneValidation.isValid) {
          return sendError(res, 'INVALID_PHONE', phoneValidation.error || 'Invalid phone number format', 400);
        }
      }

      if (!password || typeof password !== 'string' || password.length < 8) {
        return sendError(
          res,
          'WEAK_PASSWORD',
          'Password must be at least 8 characters long',
          400
        );
      }

      const existing = await store.findByEmail(email);
      if (existing) {
        return sendError(
          res,
          'USER_EXISTS',
          'An account with this email already exists',
          409
        );
      }

      const passwordHash = await PasswordHash.hash(password);
      const user = await store.create({
        email,
        passwordHash,
        name,
        phone,
        role: defaultRole
      });

      const roles = user.roles || [defaultRole];
      const tokens = jwt.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles
      });

      if (session) {
        await session.saveRefreshToken(
          user.id,
          tokens.refreshToken,
          new Date(Date.now() + 7 * 24 * 3600 * 1000),
          req.get('user-agent')
        );
      }

      if (options.onUserRegistered) {
        try {
          await options.onUserRegistered(user, req);
        } catch (hookErr) {
          console.error('[createAuthRouter] onUserRegistered hook error:', hookErr);
        }
      }

      sendSuccess(
        res,
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            roles
          },
          tokens
        },
        201
      );
    } catch (err: any) {
      sendError(res, 'SIGNUP_FAILED', err.message, 500);
    }
  };

  router.post('/signup', handleSignup);
  router.post('/register', handleSignup);

  // -------------------------------------------------------------
  // 2. LOGIN
  // -------------------------------------------------------------
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return sendError(
          res,
          'MISSING_CREDENTIALS',
          'Both email and password are required',
          400
        );
      }

      const user = await store.findByEmail(email);
      if (!user || !user.passwordHash) {
        return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }

      const isMatch = await PasswordHash.compare(password, user.passwordHash);
      if (!isMatch) {
        return sendError(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
      }

      // Check if 2FA is required
      if (user.isMfaEnabled) {
        const code = req.body.totpCode || req.body.mfaCode;
        if (!code) {
          const tempToken = jwt.generateAccessToken(
            { sub: user.id, email: user.email, isMfaVerified: false, purpose: 'mfa_pending' },
            '5m'
          );
          return sendSuccess(res, {
            mfaRequired: true,
            tempToken,
            message: 'Two-Factor Authentication is enabled. Please submit 6-digit TOTP code.'
          });
        }

        if (!checkMfaRateLimit(user.id)) {
          return sendError(
            res,
            'TOO_MANY_ATTEMPTS',
            'Too many failed verification attempts. Please wait 5 minutes before trying again.',
            429
          );
        }

        let isMfaValid = user.mfaSecret ? TotpService.verifyToken(String(code), user.mfaSecret) : false;
        if (!isMfaValid && user.mfaBackupCodes) {
          try {
            const storedCodes = JSON.parse(user.mfaBackupCodes);
            const backupRes = TotpService.verifyBackupCode(String(code), storedCodes);
            if (backupRes.isValid) {
              isMfaValid = true;
              await store.updateMfa(user.id, {
                mfaBackupCodes: JSON.stringify(backupRes.remainingHashedCodes)
              });
            }
          } catch {}
        }

        if (!isMfaValid) {
          const { locked } = recordMfaFailure(user.id);
          if (locked) {
            return sendError(
              res,
              'TOO_MANY_ATTEMPTS',
              'Too many failed verification attempts. Account locked for 5 minutes.',
              429
            );
          }
          return sendError(
            res,
            'INVALID_MFA_TOKEN',
            'Verification code is incorrect or expired',
            400
          );
        }

        clearMfaAttempts(user.id);
      }

      const roles = user.roles || [defaultRole];
      const tokens = jwt.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles,
        isMfaVerified: true
      });

      if (session) {
        await session.saveRefreshToken(
          user.id,
          tokens.refreshToken,
          new Date(Date.now() + 7 * 24 * 3600 * 1000),
          req.get('user-agent')
        );
      }

      if (options.onUserLoggedIn) {
        try {
          await options.onUserLoggedIn(user, req);
        } catch (hookErr) {
          console.error('[createAuthRouter] onUserLoggedIn hook error:', hookErr);
        }
      }

      sendSuccess(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles
        },
        tokens
      });
    } catch (err: any) {
      sendError(res, 'LOGIN_FAILED', err.message, 500);
    }
  });

  // -------------------------------------------------------------
  // 3. FORGOT PASSWORD (forget / forgot-password)
  // -------------------------------------------------------------
  const handleForgotPassword = async (req: Request, res: Response) => {
    try {
      const { email } = req.body;

      if (!email || typeof email !== 'string') {
        return sendError(res, 'EMAIL_REQUIRED', 'Email is required', 400);
      }

      const emailValidation = EmailValidator.validate(email);
      if (!emailValidation.isValid) {
        return sendError(res, 'INVALID_EMAIL', emailValidation.error || 'A valid email address is required', 400);
      }

      const user = await store.findByEmail(email);

      // Security practice: Always return generic message to prevent email enumeration
      if (!user) {
        return sendSuccess(res, {
          message:
            'If an account associated with this email exists, a password reset link has been sent.'
        });
      }

      // Generate signed password reset JWT token with dedicated secret and bound to current passwordHash
      const resetToken = jwt.generateResetToken(
        {
          sub: user.id,
          email: user.email,
          passwordHash: user.passwordHash
        },
        resetTokenExpires
      );

      const resetUrl = `${resetUrlBase}?token=${encodeURIComponent(resetToken)}`;

      // Dispatch mail hook if configured
      if (options.onSendPasswordResetMail) {
        await options.onSendPasswordResetMail({
          to: user.email,
          subject: 'Password Reset Request',
          resetUrl,
          resetToken,
          userName: user.name || undefined
        });
      }

      const responsePayload: any = {
        message:
          'If an account associated with this email exists, a password reset link has been sent.'
      };

      // Only include token in response if explicitly enabled for testing
      if (options.exposeResetTokenInResponse && process.env.NODE_ENV !== 'production') {
        responsePayload.debug = { resetToken, resetUrl };
      }

      sendSuccess(res, responsePayload);
    } catch (err: any) {
      sendError(res, 'FORGOT_PASSWORD_FAILED', err.message, 500);
    }
  };

  router.post('/forgot-password', handleForgotPassword);
  router.post('/forget', handleForgotPassword);

  // -------------------------------------------------------------
  // 4. RESET PASSWORD (reset / reset-password)
  // -------------------------------------------------------------
  const handleResetPassword = async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || typeof token !== 'string') {
        return sendError(res, 'TOKEN_REQUIRED', 'Reset token is required', 400);
      }

      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
        return sendError(
          res,
          'WEAK_PASSWORD',
          'New password must be at least 8 characters long',
          400
        );
      }

      let payload: any;
      try {
        payload = jwt.verifyResetToken(token);
      } catch (tokenErr: any) {
        return sendError(
          res,
          'INVALID_RESET_TOKEN',
          'Password reset link is invalid or has expired. Please request a new one.',
          400
        );
      }

      const user = await store.findById(payload.sub);
      if (!user) {
        return sendError(res, 'USER_NOT_FOUND', 'User does not exist', 404);
      }

      // Replay prevention: verify the token was issued for the CURRENT password hash
      if (payload.passwordHash && payload.passwordHash !== user.passwordHash) {
        return sendError(
          res,
          'RESET_TOKEN_USED',
          'Password reset link has already been used or has expired. Please request a new one.',
          400
        );
      }

      // Hash and update password
      const newPasswordHash = await PasswordHash.hash(newPassword);
      await store.updatePassword(user.id, newPasswordHash);

      // Invalidate all active sessions to force re-login across all devices
      if (session) {
        await session.revokeAllUserSessions(user.id);
      }

      if (options.onPasswordReset) {
        try {
          await options.onPasswordReset(user, req);
        } catch (hookErr) {
          console.error('[createAuthRouter] onPasswordReset hook error:', hookErr);
        }
      }

      sendSuccess(res, {
        message: 'Password has been successfully updated. You can now log in.'
      });
    } catch (err: any) {
      sendError(res, 'RESET_PASSWORD_FAILED', err.message, 500);
    }
  };

  router.post('/reset-password', handleResetPassword);
  router.post('/reset', handleResetPassword);

  // -------------------------------------------------------------
  // 5. REFRESH TOKEN (Rotation & Replay Prevention)
  // -------------------------------------------------------------
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken || typeof refreshToken !== 'string') {
        return sendError(res, 'TOKEN_REQUIRED', 'Refresh token is required', 400);
      }

      const payload = jwt.verifyRefreshToken(refreshToken);
      const user = await store.findById(payload.sub);
      if (!user) {
        return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
      }

      // If user has MFA enabled, ensure that the refresh token was issued with MFA verified
      if (user.isMfaEnabled && !payload.isMfaVerified) {
        return sendError(
          res,
          'MFA_REQUIRED',
          'Two-Factor Authentication verification is required',
          403
        );
      }

      const roles = user.roles || [defaultRole];
      const newTokens = jwt.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles,
        isMfaVerified: user.isMfaEnabled ? Boolean(payload.isMfaVerified) : true
      });

      if (session) {
        const rotated = await session.rotateRefreshToken(
          refreshToken,
          newTokens.refreshToken,
          new Date(Date.now() + 7 * 24 * 3600 * 1000)
        );

        if (!rotated) {
          return sendError(
            res,
            'INVALID_REFRESH_TOKEN',
            'Refresh token was already used or revoked',
            403
          );
        }
      }

      sendSuccess(res, { tokens: newTokens });
    } catch (err: any) {
      sendError(res, 'REFRESH_FAILED', err.message, 401);
    }
  });

  // -------------------------------------------------------------
  // 6. LOGOUT
  // -------------------------------------------------------------
  router.post('/logout', async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    if (session && refreshToken && typeof refreshToken === 'string') {
      await session.revokeRefreshToken(refreshToken);
    }
    sendSuccess(res, { message: 'Logged out successfully' });
  });

  // -------------------------------------------------------------
  // 7. GET /me (Current User Profile)
  // -------------------------------------------------------------
  router.get('/me', authenticateJwt(), async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const user = await store.findById(userId);
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    sendSuccess(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      roles: user.roles || [],
      isMfaEnabled: user.isMfaEnabled
    });
  });

  // -------------------------------------------------------------
  // 8. MFA SETUP & VERIFY
  // -------------------------------------------------------------
  const handleMfaSetup = async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const user = await store.findById(userId);
    if (!user) {
      return sendError(res, 'USER_NOT_FOUND', 'User not found', 404);
    }

    // Protection against unauthorized MFA overwrite (BUG-01)
    if (user.isMfaEnabled && !req.user!.isMfaVerified) {
      return sendError(
        res,
        'MFA_REQUIRED',
        'You must verify existing Two-Factor Authentication before setting up a new one',
        403
      );
    }

    const secret = TotpService.generateSecret();
    const uri = TotpService.getOtpAuthUri({
      issuer: 'EnterpriseAuth',
      accountName: user.email || userId,
      secret
    });
    const backupCodes = TotpService.generateBackupCodes(8);
    // Securely hash backup codes before storing (BUG-06)
    const hashedBackupCodes = backupCodes.map((code) => TotpService.hashBackupCode(code));

    await store.updateMfa(userId, {
      mfaSecret: secret,
      mfaBackupCodes: JSON.stringify(hashedBackupCodes)
    });

    sendSuccess(res, {
      secret,
      otpAuthUri: uri,
      backupCodes,
      instructions: 'Add secret to your authenticator app, save backup codes securely, then call /mfa/verify'
    });
  };

  router.post('/mfa/setup', authenticateJwt(), requireMfaVerification(), handleMfaSetup);
  router.post('/2fa/setup', authenticateJwt(), requireMfaVerification(), handleMfaSetup);

  const handleMfaVerify = async (req: Request, res: Response) => {
    const userId = req.user!.sub;
    const { token } = req.body;

    if (!token || typeof token !== 'string') {
      return sendError(res, 'TOKEN_REQUIRED', '6-digit TOTP code or backup code is required', 400);
    }

    if (!checkMfaRateLimit(userId)) {
      return sendError(
        res,
        'TOO_MANY_ATTEMPTS',
        'Too many failed verification attempts. Please wait 5 minutes before trying again.',
        429
      );
    }

    const user = await store.findById(userId);
    if (!user?.mfaSecret) {
      return sendError(res, 'MFA_NOT_SETUP', 'Please call /mfa/setup first', 400);
    }

    let isValid = TotpService.verifyToken(token, user.mfaSecret);
    let usedBackupCode = false;

    // Check backup codes if TOTP fails or code format matches backup code
    if (!isValid && user.mfaBackupCodes) {
      try {
        const storedCodes: string[] = JSON.parse(user.mfaBackupCodes);
        const backupResult = TotpService.verifyBackupCode(token, storedCodes);
        if (backupResult.isValid) {
          isValid = true;
          usedBackupCode = true;
          await store.updateMfa(userId, {
            mfaBackupCodes: JSON.stringify(backupResult.remainingHashedCodes)
          });
        }
      } catch {}
    }

    if (!isValid) {
      const { locked } = recordMfaFailure(userId);
      if (locked) {
        return sendError(
          res,
          'TOO_MANY_ATTEMPTS',
          'Too many failed verification attempts. Account locked for 5 minutes.',
          429
        );
      }
      return sendError(
        res,
        'INVALID_MFA_TOKEN',
        'Verification code is incorrect or expired',
        400
      );
    }

    clearMfaAttempts(userId);

    const wasAlreadyEnabled = user.isMfaEnabled;
    if (!wasAlreadyEnabled) {
      await store.updateMfa(userId, { isMfaEnabled: true });
    }

    const roles = user.roles || [defaultRole];
    const tokens = jwt.generateTokenPair({
      sub: user.id,
      email: user.email,
      roles,
      isMfaVerified: true
    });

    if (session) {
      await session.saveRefreshToken(
        user.id,
        tokens.refreshToken,
        new Date(Date.now() + 7 * 24 * 3600 * 1000),
        req.get('user-agent')
      );
    }

    sendSuccess(res, {
      message: wasAlreadyEnabled
        ? 'Two-Factor Authentication verified successfully'
        : 'Two-Factor Authentication is now enabled!',
      tokens
    });
  };

  router.post('/mfa/verify', authenticateJwt({ allowedPurposes: ['access', 'mfa_pending'] }), handleMfaVerify);
  router.post('/2fa/verify', authenticateJwt({ allowedPurposes: ['access', 'mfa_pending'] }), handleMfaVerify);

  return router;
}
