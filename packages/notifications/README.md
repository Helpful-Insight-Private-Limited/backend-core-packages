# @helpful-insight/notifications

[![npm version](https://img.shields.io/npm/v/@helpful-insight/notifications.svg)](https://www.npmjs.com/package/@helpful-insight/notifications)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Enterprise multi-channel notification engine for **Node.js, Express, and Prisma**. Dispatches notifications seamlessly across **In-App (Database + Live Server-Sent Events SSE stream)**, **Email**, and **HMAC-signed Webhooks**, with full support for user channel preferences and category-level muting.

---

## 🌟 Key Features

* 📡 **Multi-Channel Dispatching**:
  * `in_app`: Stores notifications in DB and pushes instantly to active browser sessions via SSE.
  * `email`: Routes through transactional email providers (e.g. `@helpful-insight/mailer`).
  * `webhook`: POSTs JSON payloads with cryptographic **HMAC-SHA256 signature** validation headers.
* ⚡ **Live Real-time Server-Sent Events (SSE)**:
  * Zero-dependency real-time push to frontend clients without needing WebSocket servers.
  * Auto-reconnect handling and client connection lifecycle management.
* 🎛️ **Granular User Preferences**:
  * Users can enable/disable channels per notification category (e.g. `marketing`, `security`, `transactional`).
  * If a user mutes marketing emails, the dispatcher automatically skips the email channel while still delivering essential in-app alerts.
* 🌐 **Turnkey Express Router**:
  * Full REST + SSE API: `GET /`, `PATCH /:id/read`, `POST /read-all`, `GET /stream`, `GET /preferences`, `PUT /preferences`.
* 🗄️ **Prisma Database Storage**:
  * Built-in Prisma schema models for notifications and user preferences.

---

## 📦 Installation

```bash
# npm
npm install @helpful-insight/notifications

# pnpm
pnpm add @helpful-insight/notifications

# yarn
yarn add @helpful-insight/notifications
```

---

## 🚀 Quick Start

```typescript
import { NotificationService } from '@helpful-insight/notifications';

const notifications = new NotificationService({
  defaultChannels: ['in_app']
});

// Dispatch notification
const { id, results } = await notifications.send({
  userId: 'user_123',
  category: 'transactional',
  title: 'Order Shipped',
  message: 'Your parcel #84920 has shipped!',
  data: { orderId: '84920', carrier: 'FedEx' }
});

console.log(id); // Notification UUID
console.log(results); // [{ channel: 'in_app', success: true }]
```

---

## ⚡ Real-Time In-App & Express Integration

Mount the pre-built notification router in Express:

```typescript
import express from 'express';
import { NotificationService, createNotificationRouter } from '@helpful-insight/notifications';

const app = express();
app.use(express.json());

// Mock auth middleware to attach user
app.use((req, res, next) => {
  req.user = { id: 'user_123' };
  next();
});

const notifications = new NotificationService();
app.use('/api/notifications', createNotificationRouter(notifications));
```

### Frontend SSE Client Connection (React / Vue / Vanilla JS):
```javascript
// Connect to real-time stream in browser
const eventSource = new EventSource('/api/notifications/stream');

eventSource.onmessage = (event) => {
  const notification = JSON.parse(event.data);
  console.log('New notification received:', notification.title, notification.message);
  // Update UI badge or trigger toast popup
};
```

---

## 🎛️ User Channel Preferences

Allow users to customize which notifications they receive:

```typescript
// Mute marketing emails for a user
await notifications.getPreferencesStore().setPreference(
  'user_123',
  'marketing',
  'email',
  false // muted
);

// This notification will skip email because user muted it
await notifications.send({
  userId: 'user_123',
  category: 'marketing',
  title: 'Weekend Sale!',
  message: '20% off on all items.',
  recipientEmail: 'user@example.com'
});
```

---

## 🗄️ Prisma Database Schema

```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  title     String
  message   String
  category  String   @default("general")
  data      String?  // JSON string
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([userId, isRead])
}

model NotificationPreference {
  id        String   @id @default(uuid())
  userId    String
  category  String
  channel   String
  enabled   Boolean  @default(true)
  updatedAt DateTime @updatedAt

  @@unique([userId, category, channel])
}
```

---

## 📄 License

MIT © Helpful Insight Private Limited
