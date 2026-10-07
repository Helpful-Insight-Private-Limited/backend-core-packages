import { prisma } from './prisma.js';
import { AppLogger, AuditService, PrismaAuditRepository } from '@helpful-insight/logger';
import { I18nService } from '@helpful-insight/i18n';
import { MailService, DevMemoryMailProvider, SmtpMailProvider } from '@helpful-insight/mailer';
import { EmailTemplateEngine, PrismaTemplateStore } from '@helpful-insight/email-templates';
import { JwtService, PrismaSessionStore, createAuthMiddleware } from '@helpful-insight/auth';
import { RbacEngine, PrismaRbacAdapter, RbacGuard } from '@helpful-insight/rbac';
import {
  NotificationService,
  InAppChannelHandler,
  PrismaInAppStore,
  EmailNotificationHandler,
  WebhookChannelHandler
} from '@helpful-insight/notifications';

// 1. Logger & Audit Trail
export const logger = new AppLogger({ name: 'enterprise-api' });
export const auditRepository = new PrismaAuditRepository(prisma);
export const auditService = new AuditService(auditRepository);

// 2. Language & i18n
export const i18nService = new I18nService({
  defaultLocale: process.env.APP_LOCALE || 'en',
  fallbackLocale: process.env.APP_FALLBACK_LOCALE || 'en',
  translations: {
    en: {
      auth: {
        welcome: 'Welcome to Enterprise API, {{name}}!',
        registered: 'Account created successfully.',
        loginSuccess: 'Login successful.',
        loginFailed: 'Invalid credentials.',
        unauthorized: 'Authentication required'
      },
      common: {
        success: 'Operation completed successfully.',
        notFound: 'Resource not found.'
      }
    },
    es: {
      auth: {
        welcome: '¡Bienvenido a Enterprise API, {{name}}!',
        registered: 'Cuenta creada con éxito.',
        loginSuccess: 'Inicio de sesión exitoso.',
        loginFailed: 'Credenciales inválidas.',
        unauthorized: 'Autenticación requerida'
      },
      common: {
        success: 'Operación completada con éxito.',
        notFound: 'Recurso no encontrado.'
      }
    },
    fr: {
      auth: {
        welcome: 'Bienvenue sur Enterprise API, {{name}}!',
        registered: 'Compte créé avec succès.',
        loginSuccess: 'Connexion réussie.',
        loginFailed: 'Identifiants invalides.',
        unauthorized: 'Authentification requise'
      }
    }
  }
});

// 3. Mail Service
const mailProvider =
  process.env.MAIL_PROVIDER === 'smtp' && process.env.SMTP_HOST
    ? new SmtpMailProvider({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 587,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
          : undefined,
        from: process.env.MAIL_FROM || 'no-reply@enterprise-app.com'
      })
    : new DevMemoryMailProvider();

export const mailService = new MailService({
  provider: mailProvider,
  defaultFrom: process.env.MAIL_FROM || 'no-reply@enterprise-app.com'
});

// 4. Email Template Engine (Prisma-backed)
export const templateStore = new PrismaTemplateStore(prisma);
export const templateEngine = new EmailTemplateEngine({
  store: templateStore,
  defaultVariables: { companyName: 'Enterprise App' }
});

// 5. Authentication & JWT
export const jwtService = new JwtService({
  accessSecret: process.env.JWT_ACCESS_SECRET || 'default-access-secret-32-characters-long',
  refreshSecret: process.env.JWT_REFRESH_SECRET || 'default-refresh-secret-32-characters-long',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRATION || '7d'
});

export const sessionStore = new PrismaSessionStore(prisma);
export const { authenticateJwt, requireMfaVerification } = createAuthMiddleware(jwtService);

// 6. RBAC & Permissions Engine
export const rbacAdapter = new PrismaRbacAdapter(prisma);
export const rbacEngine = new RbacEngine([
  {
    name: 'admin',
    description: 'Full administrative access',
    permissions: ['*']
  },
  {
    name: 'editor',
    description: 'Manage content and view users',
    permissions: ['users:read', 'posts:*', 'notifications:*']
  },
  {
    name: 'viewer',
    description: 'Read-only access',
    permissions: ['users:read', 'posts:read']
  }
]);

export const rbacGuard = new RbacGuard({
  engine: rbacEngine,
  getUser: (req) => {
    const user = (req as any).user;
    if (!user) return undefined;
    return {
      id: user.sub || user.id,
      roles: user.roles || [],
      permissions: user.permissions || []
    };
  }
});

// 7. Notification Service
export const inAppStore = new PrismaInAppStore(prisma);
export const inAppHandler = new InAppChannelHandler(inAppStore);

export const emailNotificationHandler = new EmailNotificationHandler(async (opts) => {
  const res = await mailService.send({
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html
  });
  return { success: res.success, messageId: res.messageId, error: res.error };
});

export const webhookHandler = new WebhookChannelHandler({
  secret: process.env.WEBHOOK_SECRET || 'webhook-secret'
});

export const notificationService = new NotificationService({
  defaultChannels: ['in_app']
});
notificationService.registerHandler(inAppHandler);
notificationService.registerHandler(emailNotificationHandler);
notificationService.registerHandler(webhookHandler);
