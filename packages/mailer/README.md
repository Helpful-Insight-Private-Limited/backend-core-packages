# @helpful-insight/mailer

[![npm version](https://img.shields.io/npm/v/@helpful-insight/mailer.svg)](https://www.npmjs.com/package/@helpful-insight/mailer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Unified, resilient enterprise email dispatching service for **Node.js, Express, and TypeScript**. Features support for multiple mail providers (**SMTP, AWS SES, SendGrid, Mailgun, and DevMemory**), automatic provider **failover**, exponential backoff retries, and comprehensive TypeScript interfaces.

---

## 🌟 Key Features

* 🔌 **Unified Multi-Provider Engine**:
  * `SmtpMailProvider`: Direct SMTP / Nodemailer (Gmail, Postmark, Brevo, custom relays).
  * `SesMailProvider`: AWS Simple Email Service (SES) integration.
  * `SendGridMailProvider`: SendGrid HTTP API.
  * `MailgunMailProvider`: Mailgun API.
  * `DevMemoryMailProvider`: In-memory provider for unit tests, CI/CD, and local development.
* 🛡️ **Automatic Failover & High Availability**:
  * Define a `fallbackProvider`. If the primary provider (e.g. SendGrid) suffers an outage or rate limit, the service seamlessly routes the email through the fallback provider (e.g. AWS SES or SMTP).
* 🔄 **Smart Retries with Backoff**:
  * Configurable `maxRetries` with automatic retry handling before triggering fallback.
* 📎 **Rich Email Features**:
  * HTML and plain text dual payloads.
  * Attachments, custom headers, CC, BCC, and `replyTo`.
  * Global defaults for sender address (`defaultFrom`).

---

## 📦 Installation

```bash
# npm
npm install @helpful-insight/mailer

# pnpm
pnpm add @helpful-insight/mailer

# yarn
yarn add @helpful-insight/mailer
```

---

## 🚀 Quick Start

### 1. Development Mode (In-Memory)
```typescript
import { MailService, DevMemoryMailProvider } from '@helpful-insight/mailer';

const memoryProvider = new DevMemoryMailProvider();
const mailer = new MailService({
  provider: memoryProvider,
  defaultFrom: 'noreply@mycompany.com'
});

await mailer.send({
  to: 'user@example.com',
  subject: 'Welcome to our platform',
  html: '<h1>Welcome!</h1><p>We are glad to have you.</p>',
  text: 'Welcome! We are glad to have you.'
});

// Inspect sent emails in tests
console.log(memoryProvider.getSentEmails());
```

### 2. Production SMTP (Nodemailer / Postmark / Gmail)
```typescript
import { MailService, SmtpMailProvider } from '@helpful-insight/mailer';

const smtpProvider = new SmtpMailProvider({
  host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!
  }
});

const mailer = new MailService({
  provider: smtpProvider,
  defaultFrom: 'Acme Support <support@acme.com>'
});

const result = await mailer.send({
  to: 'customer@example.com',
  subject: 'Your Invoice #1042',
  html: '<p>Thank you for your purchase.</p>'
});

console.log(result.success, result.messageId);
```

---

## 🛡️ High-Availability Failover Configuration

Protect mission-critical transactional emails (e.g., OTPs and password resets) with automatic secondary provider routing:

```typescript
import {
  MailService,
  SendGridMailProvider,
  SmtpMailProvider
} from '@helpful-insight/mailer';

const primaryProvider = new SendGridMailProvider({
  apiKey: process.env.SENDGRID_API_KEY!
});

const backupProvider = new SmtpMailProvider({
  host: process.env.BACKUP_SMTP_HOST!,
  port: 587,
  auth: {
    user: process.env.BACKUP_SMTP_USER!,
    pass: process.env.BACKUP_SMTP_PASS!
  }
});

const resilientMailer = new MailService({
  provider: primaryProvider,      // Primary carrier
  fallbackProvider: backupProvider,// Automatically takes over if primary fails
  maxRetries: 2,
  defaultFrom: 'alerts@enterprise.com'
});

const response = await resilientMailer.send({
  to: 'admin@enterprise.com',
  subject: 'Critical Security Alert',
  text: 'Unusual login detected.'
});

console.log(`Dispatched via provider: ${response.provider}`);
// If SendGrid was down, response.provider will be 'smtp'
```

---

## 📄 License

MIT © [Rohit Jain](https://github.com/Rohit-Jain11)
