import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { createHttpLoggerMiddleware } from '@helpful-insight/logger';
import { createI18nMiddleware } from '@helpful-insight/i18n';
import { createNotificationRouter } from '@helpful-insight/notifications';
import { createTemplateRouter } from '@helpful-insight/email-templates';

import {
  logger,
  auditService,
  i18nService,
  notificationService,
  templateEngine,
  authenticateJwt
} from './services.js';
import { responseEnvelopeMiddleware } from './middlewares/response.js';
import { globalErrorHandler } from './middlewares/error.js';
import { authRouter } from './routes/auth.routes.js';
import { userRouter } from './routes/user.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { swaggerDocument } from './docs/swagger.js';

export function createApp() {
  const app = express();

  // Basic Middlewares
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Custom Response Envelope & Decorators
  app.use(responseEnvelopeMiddleware());

  // Package: @helpful-insight/logger (Request correlation ID & Audit tracking)
  app.use(createHttpLoggerMiddleware({ logger, auditService, logBody: true }));

  // Package: @helpful-insight/i18n (Language detection via Header / Query / Profile)
  app.use(createI18nMiddleware({ service: i18nService }));

  // Swagger Documentation
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

  // Health check
  app.get('/health', (_req, res) => {
    res.ok({ status: 'healthy', uptime: process.uptime() });
  });

  // API Routes
  app.use('/api/auth', authRouter);
  app.use('/api/users', userRouter);
  app.use('/api/audit', auditRouter);
  app.use('/api/notifications', authenticateJwt(), createNotificationRouter(notificationService));
  app.use('/api/templates', createTemplateRouter(templateEngine));

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` }
    });
  });

  // Global RFC 7807 Error Handler
  app.use(globalErrorHandler);

  return app;
}
