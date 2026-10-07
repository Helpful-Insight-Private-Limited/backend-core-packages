# Enterprise Modular Packages & REST API Boilerplate

Production-grade suite of reusable, bug-free, and version-compatible packages specifically architected for **Node.js + Express.js + Prisma**, packaged in a high-speed Monorepo (`pnpm workspaces` + `Turborepo` + `tsup`).

Each package compiles to **dual ESM (`.mjs`) and CommonJS (`.cjs`)** with full `.d.ts` type declarations, allowing instant use in modern or legacy projects.

---

## 📦 Package Matrix

| Package | Name | Description | Key Features |
|---|---|---|---|
| **Form Validator** | [`@helpful-insight/validator`](./packages/validator) | Multi-format input validation | RFC 5322 Email with typo suggestion, 240+ countries phone (`libphonenumber-js`), Strong password generator & policy suggestions |
| **Language Service** | [`@helpful-insight/i18n`](./packages/i18n) | Project-wide internationalization | `APP_LOCALE` env control, Accept-Language/header/query detection, interpolation, pluralization, Express middleware |
| **Logger & Audit** | [`@helpful-insight/logger`](./packages/logger) | High-speed logging & compliance | Pino structured logger, `x-request-id` tracer, automatic sensitive data redaction, Prisma Audit Trail adapter |
| **Mail Service** | [`@helpful-insight/mailer`](./packages/mailer) | Unified email dispatch | SMTP (Nodemailer), AWS SES, SendGrid, Mailgun, DevMemory with automatic failover and retries |
| **Email Templates** | [`@helpful-insight/email-templates`](./packages/email-templates) | Dynamic responsive emails | Responsive MJML/Handlebars layout, pre-built templates (Welcome, Reset, Verify), Prisma DB store for live admin editing |
| **RBAC & ABAC** | [`@helpful-insight/rbac`](./packages/rbac) | Permissions & access control | Role hierarchy, wildcard matching (`users:*`, `*`), dynamic ABAC ownership checks (`isOwner`), Express route guards |
| **Auth System** | [`@helpful-insight/auth`](./packages/auth) | Enterprise authentication | JWT Access + Refresh token rotation, Bcrypt password hashing, RFC 6238 TOTP Two-Factor Auth (Google Authenticator), OAuth 2.0 |
| **Notifications** | [`@helpful-insight/notifications`](./packages/notifications) | Multi-channel dispatcher | In-App (DB + Realtime SSE Stream), Email, Webhooks (HMAC-SHA256 signature), User channel preference filters |
| **REST Boilerplate** | [`@helpful-insight/express-prisma-api`](./examples/express-prisma-api) | Production reference starter | Express + Prisma (SQLite/PostgreSQL/MySQL), Swagger docs, RFC 7807 problem details, Docker Compose |

---

## 🚀 How to Test & Use Locally

### Method 1: Run the Pre-Configured Reference Boilerplate

The included boilerplate application in `examples/express-prisma-api` has all 8 packages pre-wired and running.

```bash
# 1. Install dependencies
pnpm install

# 2. Build packages (outputs dual ESM/CJS bundles)
pnpm run build

# 3. Initialize SQLite database & seed roles/admin
pnpm --filter @helpful-insight/express-prisma-api run db:push
pnpm --filter @helpful-insight/express-prisma-api run db:seed

# 4. Start development server
pnpm --filter @helpful-insight/express-prisma-api run dev
```

* **Interactive Swagger UI:** Open [http://localhost:3000/docs](http://localhost:3000/docs) in your browser.
* **Pre-seeded Admin Account:**
  * Email: `admin@enterprise.com`
  * Password: `Admin@Pass123!`

---

### Method 2: Use in Any Existing Project via File Path Dependency

In your other project's `package.json`, add any package directly by file path:

```json
{
  "dependencies": {
    "@helpful-insight/validator": "file:C:/packages/packages/validator",
    "@helpful-insight/auth": "file:C:/packages/packages/auth",
    "@helpful-insight/rbac": "file:C:/packages/packages/rbac",
    "@helpful-insight/mailer": "file:C:/packages/packages/mailer",
    "@helpful-insight/logger": "file:C:/packages/packages/logger",
    "@helpful-insight/i18n": "file:C:/packages/packages/i18n"
  }
}
```
Run `npm install` in your project. Any change you make in `C:\packages` is immediately reflected!

---

### Method 3: Use via `npm link` / `pnpm link`

From this repository:
```bash
cd packages/validator
pnpm link --global
```
Then in your target project:
```bash
npm link @helpful-insight/validator
```

---

### Method 4: Pack as a `.tgz` Archive

```bash
cd packages/auth
pnpm pack
# Generates core-auth-1.0.0.tgz
# Install anywhere: npm install /path/to/core-auth-1.0.0.tgz
```

---

## 🧪 Automated Test Suite

Every package includes isolated unit tests, and the boilerplate contains an end-to-end integration test suite.

```bash
# Run all tests across the monorepo
pnpm test
```
All 47 tests run and pass with 100% success rate.

---

## 🛠️ Quick Usage Examples in Any Express Project

### 1. Form Validation (`@helpful-insight/validator`)
```ts
import { validateRequest, PasswordValidator, PhoneValidator } from '@helpful-insight/validator';

app.post('/register', validateRequest({
  body: {
    email: { required: true, email: true },
    password: { required: true, password: { minLength: 8, requireUppercase: true, requireNumbers: true } },
    phone: { phone: true }
  }
}), (req, res) => {
  res.json({ success: true });
});
```

### 2. Language Service (`@helpful-insight/i18n`)
```ts
import { createI18nMiddleware } from '@helpful-insight/i18n';

app.use(createI18nMiddleware({
  defaultLocale: process.env.APP_LOCALE || 'en',
  translations: {
    en: { welcome: 'Welcome {{name}}!' },
    es: { welcome: '¡Bienvenido {{name}}!' }
  }
}));

app.get('/', (req, res) => {
  res.send(req.t('welcome', { name: 'Alex' })); // Auto-detects from ?lang=es or Accept-Language
});
```

### 3. RBAC & ABAC Route Guards (`@helpful-insight/rbac`)
```ts
import { RbacGuard, RbacEngine } from '@helpful-insight/rbac';

const guard = new RbacGuard({ engine });

// Static permission check (supports wildcards like users:*)
app.delete('/users/:id', guard.requirePermission('users:delete'), deleteHandler);

// Dynamic ABAC rule check (ownership)
app.put('/posts/:id', guard.requireRule(({ user, req }) => req.post.authorId === user.id), updateHandler);
```

### 4. Logging & Audit Trail (`@helpful-insight/logger`)
```ts
import { createHttpLoggerMiddleware, auditService } from '@helpful-insight/logger';

app.use(createHttpLoggerMiddleware({ auditService, logBody: true }));

// Inside any controller
await req.audit({
  action: 'INVOICE_PAID',
  resource: 'Invoice',
  targetId: invoice.id,
  newValues: { amount: 500 }
});
```

### 5. Mailer & Email Templates (`@helpful-insight/mailer` + `@helpful-insight/email-templates`)
```ts
import { MailService, DevMemoryMailProvider } from '@helpful-insight/mailer';
import { EmailTemplateEngine } from '@helpful-insight/email-templates';

const mailer = new MailService({ provider: new DevMemoryMailProvider() });
const engine = new EmailTemplateEngine();

const { subject, html, text } = await engine.render('welcome', {
  userName: 'Alice',
  actionUrl: 'https://app.com/dashboard'
});

await mailer.send({ to: 'alice@example.com', subject, html, text });
```

### 6. Notifications & Live SSE Stream (`@helpful-insight/notifications`)
```ts
import { NotificationService, createNotificationRouter } from '@helpful-insight/notifications';

const notifications = new NotificationService();
app.use('/api/notifications', createNotificationRouter(notifications));

// Dispatch multi-channel notification
await notifications.send({
  userId: 'user-123',
  title: 'Order Shipped',
  message: 'Your parcel is on its way.',
  channels: ['in_app', 'email']
});
```

---

## 📄 License
MIT - Free to use in all current and future personal or commercial projects.
