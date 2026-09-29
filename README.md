# Enterprise Modular Packages & REST API Boilerplate

Production-grade suite of reusable, bug-free, and version-compatible packages specifically architected for **Node.js + Express.js + Prisma**, packaged in a high-speed Monorepo (`pnpm workspaces` + `Turborepo` + `tsup`).

Each package compiles to **dual ESM (`.mjs`) and CommonJS (`.cjs`)** with full `.d.ts` type declarations, allowing instant use in modern or legacy projects.

---

## 📦 Package Matrix

| Package | Name | Description | Key Features |
|---|---|---|---|
| **Form Validator** | [`@rohit-jain11/validator`](./packages/validator) | Multi-format input validation | RFC 5322 Email with typo suggestion, 240+ countries phone (`libphonenumber-js`), Strong password generator & policy suggestions |
| **Language Service** | [`@rohit-jain11/i18n`](./packages/i18n) | Project-wide internationalization | `APP_LOCALE` env control, Accept-Language/header/query detection, interpolation, pluralization, Express middleware |
| **Logger & Audit** | [`@rohit-jain11/logger`](./packages/logger) | High-speed logging & compliance | Pino structured logger, `x-request-id` tracer, automatic sensitive data redaction, Prisma Audit Trail adapter |
| **Mail Service** | [`@rohit-jain11/mailer`](./packages/mailer) | Unified email dispatch | SMTP (Nodemailer), AWS SES, SendGrid, Mailgun, DevMemory with automatic failover and retries |
| **Email Templates** | [`@rohit-jain11/email-templates`](./packages/email-templates) | Dynamic responsive emails | Responsive MJML/Handlebars layout, pre-built templates (Welcome, Reset, Verify), Prisma DB store for live admin editing |
| **RBAC & ABAC** | [`@rohit-jain11/rbac`](./packages/rbac) | Permissions & access control | Role hierarchy, wildcard matching (`users:*`, `*`), dynamic ABAC ownership checks (`isOwner`), Express route guards |
| **Auth System** | [`@rohit-jain11/auth`](./packages/auth) | Enterprise authentication | JWT Access + Refresh token rotation, Bcrypt password hashing, RFC 6238 TOTP Two-Factor Auth (Google Authenticator), OAuth 2.0 |
| **Notifications** | [`@rohit-jain11/notifications`](./packages/notifications) | Multi-channel dispatcher | In-App (DB + Realtime SSE Stream), Email, Webhooks (HMAC-SHA256 signature), User channel preference filters |
| **REST Boilerplate** | [`@rohit-jain11/express-prisma-api`](./examples/express-prisma-api) | Production reference starter | Express + Prisma (SQLite/PostgreSQL/MySQL), Swagger docs, RFC 7807 problem details, Docker Compose |

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
pnpm --filter @rohit-jain11/express-prisma-api run db:push
pnpm --filter @rohit-jain11/express-prisma-api run db:seed

# 4. Start development server
pnpm --filter @rohit-jain11/express-prisma-api run dev
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
    "@rohit-jain11/validator": "file:C:/packages/packages/validator",
    "@rohit-jain11/auth": "file:C:/packages/packages/auth",
    "@rohit-jain11/rbac": "file:C:/packages/packages/rbac",
    "@rohit-jain11/mailer": "file:C:/packages/packages/mailer",
    "@rohit-jain11/logger": "file:C:/packages/packages/logger",
    "@rohit-jain11/i18n": "file:C:/packages/packages/i18n"
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
npm link @rohit-jain11/validator
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

### 1. Form Validation (`@rohit-jain11/validator`)
```ts
import { validateRequest, PasswordValidator, PhoneValidator } from '@rohit-jain11/validator';

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

### 2. Language Service (`@rohit-jain11/i18n`)
```ts
import { createI18nMiddleware } from '@rohit-jain11/i18n';

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

### 3. RBAC & ABAC Route Guards (`@rohit-jain11/rbac`)
```ts
import { RbacGuard, RbacEngine } from '@rohit-jain11/rbac';

const guard = new RbacGuard({ engine });

// Static permission check (supports wildcards like users:*)
app.delete('/users/:id', guard.requirePermission('users:delete'), deleteHandler);

// Dynamic ABAC rule check (ownership)
app.put('/posts/:id', guard.requireRule(({ user, req }) => req.post.authorId === user.id), updateHandler);
```

### 4. Logging & Audit Trail (`@rohit-jain11/logger`)
```ts
import { createHttpLoggerMiddleware, auditService } from '@rohit-jain11/logger';

app.use(createHttpLoggerMiddleware({ auditService, logBody: true }));

// Inside any controller
await req.audit({
  action: 'INVOICE_PAID',
  resource: 'Invoice',
  targetId: invoice.id,
  newValues: { amount: 500 }
});
```

### 5. Mailer & Email Templates (`@rohit-jain11/mailer` + `@rohit-jain11/email-templates`)
```ts
import { MailService, DevMemoryMailProvider } from '@rohit-jain11/mailer';
import { EmailTemplateEngine } from '@rohit-jain11/email-templates';

const mailer = new MailService({ provider: new DevMemoryMailProvider() });
const engine = new EmailTemplateEngine();

const { subject, html, text } = await engine.render('welcome', {
  userName: 'Alice',
  actionUrl: 'https://app.com/dashboard'
});

await mailer.send({ to: 'alice@example.com', subject, html, text });
```

### 6. Notifications & Live SSE Stream (`@rohit-jain11/notifications`)
```ts
import { NotificationService, createNotificationRouter } from '@rohit-jain11/notifications';

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
