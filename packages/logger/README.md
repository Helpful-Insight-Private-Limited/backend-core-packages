# @helpful-insight/logger

[![npm version](https://img.shields.io/npm/v/@helpful-insight/logger.svg)](https://www.npmjs.com/package/@helpful-insight/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

High-performance structured logger, request correlation tracer, and SOC2/HIPAA compliance audit trail service for **Node.js, Express, and Prisma**. Built on top of **Pino** with automatic recursive redaction of sensitive credentials, distributed request tracing (`x-request-id`), and Prisma audit trail storage.

---

## 🌟 Key Features

* ⚡ **High-Speed Structured Logging (Pino)**:
  * Minimal CPU & memory overhead.
  * Formatted pretty-print in development; JSON formatted in production for Datadog, CloudWatch, or ELK.
* 🔒 **Automatic Sensitive Data Redaction**:
  * Deep recursive masking of sensitive keys: `password`, `token`, `secret`, `apiKey`, `authorization`, `creditCard`, `cvv`, etc.
  * Masks data before writing to logs or audit records (`[REDACTED]`).
* 🔗 **Distributed Request Tracing (`x-request-id`)**:
  * Automatically inspects or generates unique request correlation IDs (`x-request-id` / `x-correlation-id`).
  * Injects contextual child loggers (`req.log`) into every incoming request.
* 📜 **Enterprise Compliance Audit Trail**:
  * Track critical business actions: Actor (User/System), Action (`USER_UPDATED`, `INVOICE_PAID`), Resource, Target ID, Old Values, New Values, IP, and User-Agent.
  * Pluggable repositories: Zero-config in-memory store and production Prisma database adapter.
* 🚀 **Express HTTP Middleware**:
  * Logs request lifecycle (Method, Path, Status Code, Response Duration in ms).
  * Auto-audit capability with path filtering (e.g. ignore `/health`).

---

## 📦 Installation

```bash
# npm
npm install @helpful-insight/logger

# pnpm
pnpm add @helpful-insight/logger

# yarn
yarn add @helpful-insight/logger
```

---

## 🚀 Quick Start

### 1. Basic Structured Logging
```typescript
import { logger } from '@helpful-insight/logger';

logger.info({ userId: 'u_123' }, 'User logged in successfully');
logger.warn('Rate limit approaching threshold');
logger.error(new Error('Database connection failed'), 'Unhandled error');
```

### 2. Masking Sensitive Payloads
```typescript
import { maskSensitiveData } from '@helpful-insight/logger';

const clean = maskSensitiveData({
  username: 'john_doe',
  password: 'SuperSecretPassword!',
  nested: {
    apiKey: 'sk_live_123456789'
  }
});

console.log(clean);
// {
//   username: 'john_doe',
//   password: '[REDACTED]',
//   nested: { apiKey: '[REDACTED]' }
// }
```

### 3. Compliance Audit Trail
```typescript
import { AuditService, MemoryAuditRepository } from '@helpful-insight/logger';

const repo = new MemoryAuditRepository(); // or new PrismaAuditRepository(prisma)
const auditService = new AuditService(repo);

// Record business event
await auditService.record({
  actor: { id: 'admin_1', type: 'user', email: 'admin@company.com' },
  action: 'UPDATE_ROLE',
  resource: 'User',
  targetId: 'user_42',
  oldValues: { role: 'editor' },
  newValues: { role: 'admin' },
  ip: '192.168.1.1'
});

// Fetch recent audit logs
const logs = await auditService.getRecent(10);
```

---

## 🌐 Express HTTP Middleware

```typescript
import express from 'express';
import { createHttpLoggerMiddleware, logger, AuditService, MemoryAuditRepository } from '@helpful-insight/logger';

const app = express();
app.use(express.json());

const auditService = new AuditService(new MemoryAuditRepository());

app.use(createHttpLoggerMiddleware({
  logger,
  auditService,
  logBody: true,                       // Sanitizes and logs request body
  autoAudit: false,                     // Auto-audits state-changing HTTP calls (POST, PUT, DELETE)
  excludeAuditPaths: ['/health', '/metrics']
}));

app.post('/api/users/:id/promote', async (req, res) => {
  // Use child logger with request ID attached
  req.log.info('Promoting user');

  // Record audit trail via request helper
  await req.audit({
    action: 'PROMOTE_USER',
    resource: 'User',
    targetId: req.params.id
  });

  res.json({ success: true });
});
```

---

## 🗄️ Prisma Audit Model

```prisma
model AuditLog {
  id          String   @id @default(uuid())
  actorId     String?
  actorType   String
  action      String
  resource    String
  targetId    String?
  oldValues   String?  // JSON string
  newValues   String?  // JSON string (sanitized)
  ip          String?
  userAgent   String?
  requestId   String?
  timestamp   DateTime @default(now())
}
```

---

## 📄 License

MIT © Helpful Insight Private Limited
