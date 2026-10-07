# @helpful-insight/auth

[![npm version](https://img.shields.io/npm/v/@helpful-insight/auth.svg)](https://www.npmjs.com/package/@helpful-insight/auth)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Enterprise-grade authentication and session management engine for **Node.js, Express, and Prisma**. Features JWT Access/Refresh tokens with automatic **Token Rotation & Replay Protection**, **Bcrypt password hashing**, **RFC 6238 Two-Factor Authentication (TOTP / Google Authenticator)**, and pre-built Express authentication routes.

---

## 🌟 Key Features

* 🔑 **JWT Access & Refresh Token Service**:
  * Dual-token architecture (`accessToken` + `refreshToken`).
  * Configurable token expiry, issuer, and audience.
* 🔄 **Refresh Token Rotation & Replay Attack Defense**:
  * Single-use refresh tokens that automatically rotate on each refresh.
  * Replay detection: If an old/revoked token is re-submitted, all sessions for the user can be revoked.
* 🛡️ **Password Hashing (Bcrypt)**:
  * Secure hashing with configurable salt rounds and timing-safe comparison.
* 📱 **Two-Factor Authentication (2FA / TOTP)**:
  * RFC 6238 time-based one-time password generation and verification.
  * Google Authenticator / Authy compatible QR code URI generator.
  * Cryptographically secure backup code generator (`XXXX-XXXX`).
* 🌐 **Turnkey Express Auth Router**:
  * Ready-to-mount endpoints: `/signup`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`, `/2fa/setup`, `/2fa/verify`.
* 🗄️ **Prisma & In-Memory Stores**:
  * Production Prisma adapters and zero-dependency in-memory stores for local testing.

---

## 📦 Installation

```bash
# npm
npm install @helpful-insight/auth

# pnpm
pnpm add @helpful-insight/auth

# yarn
yarn add @helpful-insight/auth
```

---

## 🚀 Quick Start

### 1. Password Hashing
```typescript
import { PasswordHash } from '@helpful-insight/auth';

// Hash password
const hash = await PasswordHash.hash('MySecurePassword123!', 10);

// Verify password
const isValid = await PasswordHash.compare('MySecurePassword123!', hash); // true
```

### 2. JWT Access & Refresh Tokens
```typescript
import { JwtService } from '@helpful-insight/auth';

const jwt = new JwtService({
  accessSecret: process.env.JWT_ACCESS_SECRET!,
  refreshSecret: process.env.JWT_REFRESH_SECRET!,
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d'
});

// Issue access token
const token = jwt.generateAccessToken({
  sub: 'user_123',
  email: 'user@example.com',
  roles: ['admin']
});

// Verify token
const payload = jwt.verifyAccessToken(token);
console.log(payload.sub); // "user_123"
```

### 3. Two-Factor Authentication (TOTP)
```typescript
import { TotpService } from '@helpful-insight/auth';

// 1. Generate user secret & QR code URI
const secret = TotpService.generateSecret();
const qrUri = TotpService.getQrCodeUri(secret, 'user@example.com', 'MyApp');

// 2. Verify 6-digit code submitted by user from Google Authenticator
const isValid = TotpService.verifyToken('123456', secret);

// 3. Generate 8 backup codes
const backupCodes = TotpService.generateBackupCodes(8);
// => ["A3B1-9F2C", "7D4E-11AA", ...]
```

---

## 🌐 Express Route Integration

Mount the complete authentication lifecycle in your Express app in just a few lines:

```typescript
import express from 'express';
import {
  createAuthRouter,
  JwtService,
  MemoryAuthUserStore,
  MemorySessionStore,
  authenticateJwt
} from '@helpful-insight/auth';

const app = express();
app.use(express.json());

const jwtService = new JwtService({
  accessSecret: 'super-secret-access-key-32-chars-long!',
  refreshSecret: 'super-secret-refresh-key-32-chars-long!'
});

// Mount all authentication routes
app.use('/api/auth', createAuthRouter({
  userStore: new MemoryAuthUserStore(),       // Or your PrismaUserStore
  sessionStore: new MemorySessionStore(),     // Or your PrismaSessionStore
  jwtService,
  onSendPasswordResetMail: async ({ email, resetToken }) => {
    // Send email using @helpful-insight/mailer
    console.log(`Reset token for ${email}: ${resetToken}`);
  }
}));

// Protect private routes with middleware
app.get('/api/profile', authenticateJwt({ jwtService }), (req, res) => {
  res.json({ user: req.user });
});
```

### Endpoints created by `createAuthRouter`:
* `POST /signup` - Registers user with email & password.
* `POST /login` - Validates credentials, checks 2FA if enabled, returns tokens.
* `POST /refresh` - Rotates refresh token and returns new access/refresh pair.
* `POST /logout` - Revokes refresh token.
* `POST /forgot-password` - Generates reset token and invokes mail callback.
* `POST /reset-password` - Resets password using valid reset token.
* `POST /2fa/setup` - Generates TOTP secret and QR code URI.
* `POST /2fa/verify` - Enables 2FA after verifying first token.

---

## 🗄️ Database Integration (Prisma)

A ready-to-use Prisma schema is provided in the package:

```prisma
model User {
  id             String         @id @default(uuid())
  email          String         @unique
  passwordHash   String
  twoFactorSecret String?
  isTwoFactorEnabled Boolean     @default(false)
  sessions       RefreshToken[]
  createdAt      DateTime       @default(now())
}

model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  isRevoked Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```

---

## 📄 License

MIT © Helpful Insight Private Limited
