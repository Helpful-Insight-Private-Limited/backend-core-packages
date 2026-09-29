"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  EmailNotificationHandler: () => EmailNotificationHandler,
  InAppChannelHandler: () => InAppChannelHandler,
  MemoryInAppStore: () => MemoryInAppStore,
  MemoryPreferencesStore: () => MemoryPreferencesStore,
  NotificationService: () => NotificationService,
  PRISMA_NOTIFICATION_SCHEMA_SNIPPET: () => PRISMA_NOTIFICATION_SCHEMA_SNIPPET,
  PrismaInAppStore: () => PrismaInAppStore,
  WebhookChannelHandler: () => WebhookChannelHandler,
  createNotificationRouter: () => createNotificationRouter
});
module.exports = __toCommonJS(index_exports);

// src/preferences.ts
var MemoryPreferencesStore = class {
  // Key format: `${userId}:${category}:${channel}`
  prefs = /* @__PURE__ */ new Map();
  async isChannelEnabled(userId, category, channel) {
    if (category.toLowerCase() === "security") {
      return true;
    }
    const key = `${userId}:${category}:${channel}`;
    const value = this.prefs.get(key);
    return value !== void 0 ? value : true;
  }
  async setPreference(userId, category, channel, enabled) {
    const key = `${userId}:${category}:${channel}`;
    this.prefs.set(key, enabled);
  }
  async getUserPreferences(userId) {
    const results = [];
    for (const [key, enabled] of this.prefs.entries()) {
      if (key.startsWith(`${userId}:`)) {
        const [, category, channel] = key.split(":");
        results.push({ userId, category, channel, enabled });
      }
    }
    return results;
  }
};

// src/channels/in-app.ts
var import_events = require("events");
var MemoryInAppStore = class {
  notifications = /* @__PURE__ */ new Map();
  async save(notification) {
    this.notifications.set(notification.id, { ...notification });
  }
  async getUserNotifications(userId, unreadOnly = false) {
    const list = Array.from(this.notifications.values()).filter(
      (n) => n.userId === userId && (!unreadOnly || !n.isRead)
    );
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async markAsRead(id, userId) {
    const item = this.notifications.get(id);
    if (item && item.userId === userId) {
      item.isRead = true;
      item.readAt = /* @__PURE__ */ new Date();
      return true;
    }
    return false;
  }
  async markAllAsRead(userId) {
    let count = 0;
    for (const item of this.notifications.values()) {
      if (item.userId === userId && !item.isRead) {
        item.isRead = true;
        item.readAt = /* @__PURE__ */ new Date();
        count++;
      }
    }
    return count;
  }
};
var PrismaInAppStore = class {
  constructor(prisma) {
    this.prisma = prisma;
  }
  prisma;
  async save(notification) {
    if (!this.prisma?.notification) return;
    await this.prisma.notification.create({
      data: {
        id: notification.id,
        userId: notification.userId,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        data: notification.data ? JSON.stringify(notification.data) : null,
        isRead: notification.isRead,
        createdAt: notification.createdAt
      }
    });
  }
  async getUserNotifications(userId, unreadOnly = false) {
    if (!this.prisma?.notification) return [];
    const where = { userId };
    if (unreadOnly) where.isRead = false;
    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" }
    });
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      category: r.category,
      title: r.title,
      message: r.message,
      data: r.data ? JSON.parse(r.data) : void 0,
      isRead: r.isRead,
      readAt: r.readAt,
      createdAt: r.createdAt
    }));
  }
  async markAsRead(id, userId) {
    if (!this.prisma?.notification) return false;
    try {
      await this.prisma.notification.update({
        where: { id, userId },
        data: { isRead: true, readAt: /* @__PURE__ */ new Date() }
      });
      return true;
    } catch {
      return false;
    }
  }
  async markAllAsRead(userId) {
    if (!this.prisma?.notification) return 0;
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: /* @__PURE__ */ new Date() }
    });
    return res.count;
  }
};
var InAppChannelHandler = class {
  constructor(store = new MemoryInAppStore()) {
    this.store = store;
  }
  store;
  channelName = "in_app";
  emitter = new import_events.EventEmitter();
  getStore() {
    return this.store;
  }
  async send(notification) {
    const record = {
      id: notification.id || `notif_${Math.random().toString(36).substring(2, 11)}`,
      userId: notification.userId,
      category: notification.category || "system",
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: false,
      createdAt: /* @__PURE__ */ new Date()
    };
    await this.store.save(record);
    this.emitter.emit(`user:${notification.userId}`, record);
    return {
      channel: this.channelName,
      success: true,
      messageId: record.id
    };
  }
  subscribe(userId, callback) {
    const eventName = `user:${userId}`;
    this.emitter.on(eventName, callback);
    return () => {
      this.emitter.off(eventName, callback);
    };
  }
};

// src/dispatcher.ts
var NotificationService = class {
  handlers = /* @__PURE__ */ new Map();
  preferencesStore;
  defaultChannels;
  constructor(options = {}) {
    this.preferencesStore = options.preferencesStore || new MemoryPreferencesStore();
    this.defaultChannels = options.defaultChannels || ["in_app"];
    this.registerHandler(new InAppChannelHandler());
  }
  registerHandler(handler) {
    this.handlers.set(handler.channelName, handler);
  }
  getInAppHandler() {
    return this.handlers.get("in_app");
  }
  getPreferencesStore() {
    return this.preferencesStore;
  }
  async send(notification) {
    const id = notification.id || `notif_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    const payload = {
      ...notification,
      id,
      category: notification.category || "system"
    };
    const targetChannels = payload.channels || this.defaultChannels;
    const results = [];
    const deliveryPromises = targetChannels.map(async (channelName) => {
      const isEnabled = await this.preferencesStore.isChannelEnabled(
        payload.userId,
        payload.category,
        channelName
      );
      if (!isEnabled) {
        return {
          channel: channelName,
          success: false,
          error: `Muted by user channel preference for category '${payload.category}'`
        };
      }
      const handler = this.handlers.get(channelName);
      if (!handler) {
        return {
          channel: channelName,
          success: false,
          error: `No handler registered for channel '${channelName}'`
        };
      }
      return handler.send(payload);
    });
    const settled = await Promise.all(deliveryPromises);
    results.push(...settled);
    return { id, results };
  }
};

// src/channels/webhook.ts
var crypto = __toESM(require("crypto"));
var WebhookChannelHandler = class {
  channelName = "webhook";
  secret;
  defaultWebhookUrl;
  timeoutMs;
  constructor(options = {}) {
    this.secret = options.secret || "default-webhook-secret";
    this.defaultWebhookUrl = options.defaultWebhookUrl;
    this.timeoutMs = options.timeoutMs || 5e3;
  }
  async send(notification) {
    const targetUrl = notification.webhookUrl || this.defaultWebhookUrl;
    if (!targetUrl) {
      return {
        channel: this.channelName,
        success: false,
        error: "No webhook URL provided in payload or default configuration"
      };
    }
    const payload = JSON.stringify({
      id: notification.id,
      event: `notification.${notification.category || "general"}`,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const signature = crypto.createHmac("sha256", this.secret).update(payload).digest("hex");
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signature,
          "x-webhook-timestamp": Date.now().toString()
        },
        body: payload,
        signal: controller.signal
      });
      clearTimeout(timer);
      if (!res.ok) {
        return {
          channel: this.channelName,
          success: false,
          error: `Webhook receiver returned status ${res.status}`
        };
      }
      return {
        channel: this.channelName,
        success: true,
        messageId: `wh_${Date.now()}`
      };
    } catch (err) {
      return {
        channel: this.channelName,
        success: false,
        error: err.message || "Webhook dispatch failed"
      };
    }
  }
};

// src/channels/email.ts
var EmailNotificationHandler = class {
  constructor(mailSender) {
    this.mailSender = mailSender;
  }
  mailSender;
  channelName = "email";
  async send(notification) {
    if (!notification.recipientEmail) {
      return {
        channel: this.channelName,
        success: false,
        error: "Recipient email address not provided"
      };
    }
    try {
      const result = await this.mailSender({
        to: notification.recipientEmail,
        subject: notification.title,
        text: notification.message,
        html: `<p>${notification.message}</p>`
      });
      return {
        channel: this.channelName,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      };
    } catch (err) {
      return {
        channel: this.channelName,
        success: false,
        error: err.message || "Email delivery failed"
      };
    }
  }
};

// src/prisma-schema.ts
var PRISMA_NOTIFICATION_SCHEMA_SNIPPET = `
model Notification {
  id        String    @id @default(uuid())
  userId    String
  category  String    @default("system")
  title     String
  message   String
  data      String?   // JSON object string
  isRead    Boolean   @default(false)
  readAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([userId, isRead])
}

model NotificationPreference {
  id        String   @id @default(uuid())
  userId    String
  category  String
  channel   String
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([userId, category, channel])
}
`;

// src/express.ts
var import_express = require("express");
function createNotificationRouter(service) {
  const router = (0, import_express.Router)();
  const inAppHandler = service.getInAppHandler();
  const getUserId = (req) => {
    return req.user?.id || req.user?.sub;
  };
  router.get("/", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!inAppHandler) {
      res.status(500).json({ success: false, error: "In-app notification handler not configured" });
      return;
    }
    const unreadOnly = req.query.unreadOnly === "true";
    const notifications = await inAppHandler.getStore().getUserNotifications(userId, unreadOnly);
    res.json({ success: true, data: notifications });
  });
  router.patch("/:id/read", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!inAppHandler) {
      res.status(500).json({ success: false, error: "In-app handler not configured" });
      return;
    }
    const notifId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updated = await inAppHandler.getStore().markAsRead(notifId, userId);
    res.json({ success: true, updated });
  });
  router.post("/read-all", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!inAppHandler) {
      res.status(500).json({ success: false, error: "In-app handler not configured" });
      return;
    }
    const count = await inAppHandler.getStore().markAllAsRead(userId);
    res.json({ success: true, count });
  });
  router.get("/stream", (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    if (!inAppHandler) {
      res.status(500).json({ success: false, error: "In-app handler not configured" });
      return;
    }
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ event: "connected", userId })}

`);
    const unsubscribe = inAppHandler.subscribe(userId, (notif) => {
      res.write(`data: ${JSON.stringify(notif)}

`);
    });
    req.on("close", () => {
      unsubscribe();
    });
  });
  router.get("/preferences", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const prefs = await service.getPreferencesStore().getUserPreferences(userId);
    res.json({ success: true, data: prefs });
  });
  router.put("/preferences", async (req, res) => {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
    const { category, channel, enabled } = req.body;
    if (!category || !channel || typeof enabled !== "boolean") {
      res.status(400).json({
        success: false,
        error: "Fields category, channel, and enabled (boolean) are required"
      });
      return;
    }
    await service.getPreferencesStore().setPreference(userId, category, channel, enabled);
    res.json({ success: true, message: "Preference updated successfully" });
  });
  return router;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EmailNotificationHandler,
  InAppChannelHandler,
  MemoryInAppStore,
  MemoryPreferencesStore,
  NotificationService,
  PRISMA_NOTIFICATION_SCHEMA_SNIPPET,
  PrismaInAppStore,
  WebhookChannelHandler,
  createNotificationRouter
});
