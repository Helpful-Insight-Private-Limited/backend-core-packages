# @helpful-insight/email-templates

[![npm version](https://img.shields.io/npm/v/@helpful-insight/email-templates.svg)](https://www.npmjs.com/package/@helpful-insight/email-templates)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Dynamic, responsive, and database-editable email template engine for **Node.js, Express, and Prisma**. Includes pre-designed responsive HTML email layouts, Handlebars-style variable interpolation, plain text generation, Prisma database persistence, and an Express management router with live browser preview.

---

## 🌟 Key Features

* 📱 **Pre-Built Responsive Email Templates**:
  * `welcome`: New user onboarding with call-to-action button.
  * `forgot-password`: Password reset link with expiry timer.
  * `verify-email`: Email confirmation link.
  * `otp-verification`: Clean 6-digit OTP code layout.
* ✍️ **Dynamic Handlebars-style Interpolation**:
  * Safe variable substitution for `{{userName}}`, `{{companyName}}`, `{{actionUrl}}`, etc.
  * Automatically generates both modern responsive HTML and fallback plain text.
* 🗄️ **Multi-Store Architecture (Memory & Prisma DB)**:
  * In-memory store for quick setup.
  * Prisma database store enabling admins to edit templates on the fly without server redeployment.
* 🌐 **Turnkey Express Template Management Router**:
  * CRUD endpoints for templates: `GET /`, `GET /:name`, `POST /`, `DELETE /:name`.
  * Live HTML visual preview endpoint: `GET /:name/preview`.

---

## 📦 Installation

```bash
# npm
npm install @helpful-insight/email-templates

# pnpm
pnpm add @helpful-insight/email-templates

# yarn
yarn add @helpful-insight/email-templates
```

---

## 🚀 Quick Start

```typescript
import { EmailTemplateEngine } from '@helpful-insight/email-templates';

const engine = new EmailTemplateEngine();

// Render pre-built welcome template
const { subject, html, text } = await engine.render('welcome', {
  userName: 'Alice',
  companyName: 'Acme Corp',
  actionUrl: 'https://example.com/dashboard'
});

console.log(subject); // "Welcome to Acme Corp, Alice!"
console.log(html);    // "<!DOCTYPE html>... responsive email ..."
console.log(text);    // "Hello Alice, welcome to Acme Corp! ..."
```

---

## 🎨 Adding Custom Templates

You can create custom templates dynamically:

```typescript
await engine.saveTemplate({
  name: 'order-confirmation',
  subject: 'Order #{{orderId}} Confirmed!',
  html: `
    <h2>Hi {{customerName}},</h2>
    <p>Your order for <strong>{{productName}}</strong> has been confirmed.</p>
    <a href="{{trackingUrl}}">Track Package</a>
  `,
  variables: ['customerName', 'orderId', 'productName', 'trackingUrl'],
  description: 'Sent when customer completes checkout'
});

// Render custom template
const email = await engine.render('order-confirmation', {
  customerName: 'Bob',
  orderId: 'ORD-9821',
  productName: 'Pro Subscription',
  trackingUrl: 'https://example.com/track/ORD-9821'
});
```

---

## 🌐 Express Router & Live Preview

Mount template management APIs and preview emails directly in your browser:

```typescript
import express from 'express';
import { EmailTemplateEngine, createTemplateRouter } from '@helpful-insight/email-templates';

const app = express();
app.use(express.json());

const engine = new EmailTemplateEngine();

// Mount template router
app.use('/api/templates', createTemplateRouter(engine));

app.listen(3000, () => {
  console.log('Template manager running on http://localhost:3000/api/templates');
  console.log('Preview welcome email: http://localhost:3000/api/templates/welcome/preview');
});
```

### Endpoints:
* `GET /api/templates` - Lists all available templates.
* `GET /api/templates/:name` - Retrieves a specific template schema.
* `POST /api/templates` - Creates or updates a template in the store.
* `DELETE /api/templates/:name` - Deletes a custom template.
* `GET /api/templates/:name/preview` - Renders live HTML in browser with mock query parameters.

---

## 🗄️ Prisma Database Persistence

To allow template editing from an admin panel without redeploying code:

```typescript
import { EmailTemplateEngine, PrismaTemplateStore } from '@helpful-insight/email-templates';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const store = new PrismaTemplateStore(prisma);
const engine = new EmailTemplateEngine({ store });
```

### Prisma Model:
```prisma
model EmailTemplate {
  id          String   @id @default(uuid())
  name        String   @unique
  subject     String
  html        String
  text        String?
  variables   String   // JSON string of array
  isSystem    Boolean  @default(false)
  updatedAt   DateTime @updatedAt
}
```

---

## 📄 License

MIT © Helpful Insight Private Limited
