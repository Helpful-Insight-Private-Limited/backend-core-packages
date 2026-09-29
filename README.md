# Enterprise Modular Packages & REST API Boilerplate

Production-grade suite of reusable, bug-free, and version-compatible packages specifically architected for **Node.js + Express.js + Prisma**, packaged in a high-speed Monorepo (`pnpm workspaces` + `Turborepo` + `tsup`).

Each package compiles to **dual ESM (`.mjs`) and CommonJS (`.cjs`)** with full `.d.ts` type declarations, allowing instant use in modern or legacy projects.

---

## 📦 Package Matrix

| Package | Name | Description | Key Features |
|---|---|---|---|
| **Form Validator** | [`@core/validator`](./packages/validator) | Multi-format input validation | RFC 5322 Email with typo suggestion, 240+ countries phone (`libphonenumber-js`), Strong password generator & policy suggestions |
| **Language Service** | [`@core/i18n`](./packages/i18n) | Project-wide internationalization | `APP_LOCALE` env control, Accept-Language/header/query detection, interpolation, pluralization, Express middleware |
| **Logger & Audit** | [`@core/logger`](./packages/logger) | High-speed logging & compliance | Pino structured logger, `x-request-id` tracer, automatic sensitive data redaction, Prisma Audit Trail adapter |
| **Mail Service** | [`@core/mailer`](./packages/mailer) | Unified email dispatch | SMTP (Nodemailer), AWS SES, SendGrid, Mailgun, DevMemory with automatic failover and retries |
| **Email Templates** | [`@core/email-templates`](./packages/email-templates) | Dynamic responsive emails | Responsive MJML/Handlebars layout, pre-built templates (Welcome, Reset, Verify), Prisma DB store for live admin editing |
| **RBAC & ABAC** | [`@core/rbac`](./packages/rbac) | Permissions & access control | Role hierarchy, wildcard matching (`users:*`, `*`), dynamic ABAC ownership checks (`isOwner`), Express route guards |
| **Auth System** | [`@core/auth`](./packages/auth) | Enterprise authentication | JWT Access + Refresh token rotation, Bcrypt password hashing, RFC 6238 TOTP Two-Factor Auth (Google Authenticator), OAuth 2.0 |
| **Notifications** | [`@core/notifications`](./packages/notifications) | Multi-channel dispatcher | In-App (DB + Realtime SSE Stream), Email, Webhooks (HMAC-SHA256 signature), User channel preference filters |
| **REST Boilerplate** | [`@core/express-prisma-api`](./examples/express-prisma-api) | Production reference starter | Express + Prisma (SQLite/PostgreSQL/MySQL), Swagger docs, RFC 7807 problem details, Docker Compose |

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
pnpm --filter @core/express-prisma-api run db:push
pnpm --filter @core/express-prisma-api run db:seed

# 4. Start development server
pnpm --filter @core/express-prisma-api run dev
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
    "@core/validator": "file:C:/packages/packages/validator",
    "@core/auth": "file:C:/packages/packages/auth",
    "@core/rbac": "file:C:/packages/packages/rbac",
    "@core/mailer": "file:C:/packages/packages/mailer",
    "@core/logger": "file:C:/packages/packages/logger",
    "@core/i18n": "file:C:/packages/packages/i18n"
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
npm link @core/validator
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

### 1. Form Validation (`@core/validator`)
```ts
import { validateRequest, PasswordValidator, PhoneValidator } from '@core/validator';

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

### 2. Language Service (`@core/i18n`)
```ts
import { createI18nMiddleware } from '@core/i18n';

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

### 3. RBAC & ABAC Route Guards (`@core/rbac`)
```ts
import { RbacGuard, RbacEngine } from '@core/rbac';

const guard = new RbacGuard({ engine });

// Static permission check (supports wildcards like users:*)
app.delete('/users/:id', guard.requirePermission('users:delete'), deleteHandler);

// Dynamic ABAC rule check (ownership)
app.put('/posts/:id', guard.requireRule(({ user, req }) => req.post.authorId === user.id), updateHandler);
```

### 4. Logging & Audit Trail (`@core/logger`)
```ts
import { createHttpLoggerMiddleware, auditService } from '@core/logger';

app.use(createHttpLoggerMiddleware({ auditService, logBody: true }));

// Inside any controller
await req.audit({
  action: 'INVOICE_PAID',
  resource: 'Invoice',
  targetId: invoice.id,
  newValues: { amount: 500 }
});
```

### 5. Mailer & Email Templates (`@core/mailer` + `@core/email-templates`)
```ts
import { MailService, DevMemoryMailProvider } from '@core/mailer';
import { EmailTemplateEngine } from '@core/email-templates';

const mailer = new MailService({ provider: new DevMemoryMailProvider() });
const engine = new EmailTemplateEngine();

const { subject, html, text } = await engine.render('welcome', {
  userName: 'Alice',
  actionUrl: 'https://app.com/dashboard'
});

await mailer.send({ to: 'alice@example.com', subject, html, text });
```

### 6. Notifications & Live SSE Stream (`@core/notifications`)
```ts
import { NotificationService, createNotificationRouter } from '@core/notifications';

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
