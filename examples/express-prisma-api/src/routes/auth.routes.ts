import { Router, Request, Response } from 'express';
import { validateRequest, EmailValidator, PhoneValidator, PasswordValidator } from '@rohit-jain11/validator';
import { PasswordHash, TotpService } from '@rohit-jain11/auth';
import { prisma } from '../prisma.js';
import {
  jwtService,
  sessionStore,
  mailService,
  templateEngine,
  notificationService,
  authenticateJwt,
  requireMfaVerification
} from '../services.js';

export const authRouter = Router();

// 1. REGISTER
authRouter.post(
  '/register',
  validateRequest({
    body: {
      email: { required: true, email: true },
      password: { required: true, password: { minLength: 8, requireUppercase: true, requireNumbers: true } },
      phone: { phone: true }
    }
  }),
  async (req: Request, res: Response) => {
    try {
      const { email, password, name, phone, language } = req.body;

      // Check if user already exists
      const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (existing) {
        res.fail('USER_EXISTS', 'A user with this email address already exists.', 409);
        return;
      }

      // Hash password
      const passwordHash = await PasswordHash.hash(password);

      // Create user in DB
      const user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          name: name || email.split('@')[0],
          phone: phone ? PhoneValidator.formatE164(phone) || phone : null,
          language: language || req.locale || 'en'
        }
      });

      // Assign default role ('viewer' or 'admin' if first user)
      const userCount = await prisma.user.count();
      const defaultRoleName = userCount === 1 ? 'admin' : 'viewer';

      let role = await prisma.role.findUnique({ where: { name: defaultRoleName } });
      if (!role) {
        role = await prisma.role.create({
          data: { name: defaultRoleName, description: `Default ${defaultRoleName} role` }
        });
      }

      await prisma.userRole.create({
        data: { userId: user.id, roleId: role.id }
      });

      // Audit registration
      if (req.audit) {
        await req.audit({
          actor: { id: user.id, email: user.email },
          action: 'USER_REGISTERED',
          resource: 'User',
          targetId: user.id,
          newValues: { email: user.email, role: defaultRoleName }
        });
      }

      // Send Welcome Email asynchronously
      try {
        const emailContent = await templateEngine.render('welcome', {
          userName: user.name,
          companyName: 'Enterprise REST API',
          actionUrl: 'http://localhost:3000/docs'
        });

        await mailService.send({
          to: user.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text
        });
      } catch (mailErr) {
        req.logger?.warn({ err: mailErr }, 'Welcome email dispatch failed (non-blocking)');
      }

      // Send In-App notification
      await notificationService.send({
        userId: user.id,
        category: 'system',
        title: 'Welcome to Enterprise API!',
        message: 'Your account is ready. Explore our documentation to get started.'
      });

      // Generate tokens
      const tokenPair = jwtService.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles: [defaultRoleName]
      });

      await sessionStore.saveRefreshToken(
        user.id,
        tokenPair.refreshToken,
        new Date(Date.now() + 7 * 24 * 3600 * 1000),
        req.get('user-agent')
      );

      res.ok(
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: defaultRoleName
          },
          tokens: tokenPair,
          message: req.t('auth.registered')
        },
        undefined,
        201
      );
    } catch (err: any) {
      res.fail('REGISTRATION_FAILED', err.message, 500);
    }
  }
);

// 2. LOGIN
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.fail('INVALID_INPUT', 'Email and password are required', 400);
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: { include: { role: true } } }
    });

    if (!user || !user.passwordHash) {
      res.fail('INVALID_CREDENTIALS', req.t('auth.loginFailed', { fallback: 'Invalid credentials' }), 401);
      return;
    }

    const isMatch = await PasswordHash.compare(password, user.passwordHash);
    if (!isMatch) {
      res.fail('INVALID_CREDENTIALS', req.t('auth.loginFailed', { fallback: 'Invalid credentials' }), 401);
      return;
    }

    const roles = user.roles.map((r: any) => r.role.name);

    // If 2FA enabled, issue temporary MFA token unless code is supplied
    if (user.isMfaEnabled) {
      const code = req.body.totpCode || req.body.mfaCode;
      if (!code) {
        const mfaTempToken = jwtService.generateAccessToken(
          { sub: user.id, email: user.email, isMfaVerified: false, purpose: 'mfa_pending' },
          '5m'
        );
        res.ok({ mfaRequired: true, tempToken: mfaTempToken });
        return;
      }

      let isMfaValid = user.mfaSecret ? TotpService.verifyToken(String(code), user.mfaSecret) : false;
      if (!isMfaValid && user.mfaBackupCodes) {
        try {
          const storedCodes = JSON.parse(user.mfaBackupCodes);
          const backupRes = TotpService.verifyBackupCode(String(code), storedCodes);
          if (backupRes.isValid) {
            isMfaValid = true;
            await prisma.user.update({
              where: { id: user.id },
              data: { mfaBackupCodes: JSON.stringify(backupRes.remainingHashedCodes) }
            });
          }
        } catch {}
      }

      if (!isMfaValid) {
        res.fail('INVALID_MFA_TOKEN', 'Verification code is invalid or has expired', 400);
        return;
      }
    }

    // Generate tokens
    const tokenPair = jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      roles,
      isMfaVerified: true
    });

    await sessionStore.saveRefreshToken(
      user.id,
      tokenPair.refreshToken,
      new Date(Date.now() + 7 * 24 * 3600 * 1000),
      req.get('user-agent')
    );

    if (req.audit) {
      await req.audit({
        actor: { id: user.id, email: user.email },
        action: 'USER_LOGIN',
        resource: 'User',
        targetId: user.id
      });
    }

    res.ok({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles
      },
      tokens: tokenPair,
      message: req.t('auth.loginSuccess')
    });
  } catch (err: any) {
    res.fail('LOGIN_FAILED', err.message, 500);
  }
});

// 3. REFRESH TOKEN (Rotation & Replay Protection)
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.fail('TOKEN_REQUIRED', 'Refresh token is required', 400);
      return;
    }

    const payload = jwtService.verifyRefreshToken(refreshToken);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } }
    });

    if (!user) {
      res.fail('USER_NOT_FOUND', 'User not found', 404);
      return;
    }

    if (user.isMfaEnabled && !payload.isMfaVerified) {
      res.fail('MFA_REQUIRED', 'Two-Factor Authentication verification is required', 403);
      return;
    }

    const roles = user.roles.map((r: any) => r.role.name);
    const newTokens = jwtService.generateTokenPair({
      sub: user.id,
      email: user.email,
      roles,
      isMfaVerified: user.isMfaEnabled ? Boolean(payload.isMfaVerified) : true
    });

    const rotated = await sessionStore.rotateRefreshToken(
      refreshToken,
      newTokens.refreshToken,
      new Date(Date.now() + 7 * 24 * 3600 * 1000)
    );

    if (!rotated) {
      res.fail('INVALID_REFRESH_TOKEN', 'Token has been revoked or reused', 403);
      return;
    }

    res.ok({ tokens: newTokens });
  } catch (err: any) {
    res.fail('REFRESH_FAILED', err.message, 401);
  }
});

// 4. LOGOUT
authRouter.post('/logout', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await sessionStore.revokeRefreshToken(refreshToken);
  }
  res.ok({ message: 'Logged out successfully' });
});

// 5. MFA: SETUP
authRouter.post('/mfa/setup', authenticateJwt(), requireMfaVerification(), async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.isMfaEnabled && !req.user!.isMfaVerified) {
    res.fail('MFA_REQUIRED', 'Please verify existing Two-Factor Authentication first', 403);
    return;
  }

  const secret = TotpService.generateSecret();
  const uri = TotpService.getOtpAuthUri({
    issuer: 'EnterpriseAPI',
    accountName: req.user!.email || userId,
    secret
  });
  const backupCodes = TotpService.generateBackupCodes(8);
  const hashedBackupCodes = backupCodes.map((c) => TotpService.hashBackupCode(c));

  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: secret,
      mfaBackupCodes: JSON.stringify(hashedBackupCodes)
    }
  });

  res.ok({
    secret,
    otpAuthUri: uri,
    backupCodes,
    instructions: 'Enter this secret or scan QR code in Google Authenticator, save backup codes safely, then call /mfa/verify'
  });
});

// 6. MFA: VERIFY & ACTIVATE
authRouter.post('/mfa/verify', authenticateJwt({ allowedPurposes: ['access', 'mfa_pending'] }), async (req: Request, res: Response) => {
  const userId = req.user!.sub;
  const { token } = req.body;

  if (!token) {
    res.fail('TOKEN_REQUIRED', '6-digit code or backup code is required', 400);
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.mfaSecret) {
    res.fail('MFA_NOT_SETUP', 'Call /mfa/setup first', 400);
    return;
  }

  let isValid = TotpService.verifyToken(token, user.mfaSecret);
  if (!isValid && user.mfaBackupCodes) {
    try {
      const storedCodes = JSON.parse(user.mfaBackupCodes);
      const backupRes = TotpService.verifyBackupCode(token, storedCodes);
      if (backupRes.isValid) {
        isValid = true;
        await prisma.user.update({
          where: { id: userId },
          data: { mfaBackupCodes: JSON.stringify(backupRes.remainingHashedCodes) }
        });
      }
    } catch {}
  }

  if (!isValid) {
    res.fail('INVALID_MFA_TOKEN', 'Verification code is invalid or has expired', 400);
    return;
  }

  const wasAlreadyEnabled = user.isMfaEnabled;
  if (!wasAlreadyEnabled) {
    await prisma.user.update({
      where: { id: userId },
      data: { isMfaEnabled: true }
    });
  }

  const roles = user.roles?.map((r: any) => r.role.name) || [];
  const tokenPair = jwtService.generateTokenPair({
    sub: user.id,
    email: user.email,
    roles,
    isMfaVerified: true
  });

  await sessionStore.saveRefreshToken(
    user.id,
    tokenPair.refreshToken,
    new Date(Date.now() + 7 * 24 * 3600 * 1000),
    req.get('user-agent')
  );

  res.ok({
    message: wasAlreadyEnabled
      ? 'Two-Factor Authentication verified successfully'
      : 'Two-Factor Authentication is now enabled!',
    tokens: tokenPair
  });
});
