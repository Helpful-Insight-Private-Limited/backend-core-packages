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
  AppLogger: () => AppLogger,
  AuditService: () => AuditService,
  ConsoleAuditRepository: () => ConsoleAuditRepository,
  MemoryAuditRepository: () => MemoryAuditRepository,
  PrismaAuditRepository: () => PrismaAuditRepository,
  createHttpLoggerMiddleware: () => createHttpLoggerMiddleware,
  defaultLogger: () => defaultLogger,
  maskSensitiveData: () => maskSensitiveData
});
module.exports = __toCommonJS(index_exports);

// src/logger.ts
var import_pino = __toESM(require("pino"));
var AppLogger = class {
  pinoInstance;
  constructor(options = {}) {
    const isDevelopment = process.env.NODE_ENV !== "production";
    const level = options.level || process.env.LOG_LEVEL || (isDevelopment ? "debug" : "info");
    const redact = options.redactPaths || [
      "req.headers.authorization",
      "req.headers.cookie",
      "password",
      "token",
      "refreshToken",
      "accessToken",
      "secret",
      "creditCard",
      "cvv"
    ];
    const pinoOptions = {
      level,
      name: options.name || "api",
      redact: {
        paths: redact,
        censor: "[REDACTED]"
      },
      timestamp: import_pino.default.stdTimeFunctions.isoTime
    };
    if (options.prettyPrint ?? isDevelopment) {
      pinoOptions.transport = {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname"
        }
      };
    }
    this.pinoInstance = (0, import_pino.default)(pinoOptions);
  }
  getRawLogger() {
    return this.pinoInstance;
  }
  info(msg, obj) {
    if (obj) this.pinoInstance.info(obj, msg);
    else this.pinoInstance.info(msg);
  }
  warn(msg, obj) {
    if (obj) this.pinoInstance.warn(obj, msg);
    else this.pinoInstance.warn(msg);
  }
  error(msg, err) {
    if (err) this.pinoInstance.error({ err }, msg);
    else this.pinoInstance.error(msg);
  }
  debug(msg, obj) {
    if (obj) this.pinoInstance.debug(obj, msg);
    else this.pinoInstance.debug(msg);
  }
  child(bindings) {
    return this.pinoInstance.child(bindings);
  }
};
var defaultLogger = new AppLogger();

// src/sanitizer.ts
var DEFAULT_SENSITIVE_KEYS = /* @__PURE__ */ new Set([
  "password",
  "passwordconfirmation",
  "currentpassword",
  "newpassword",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "secret",
  "clientsecret",
  "apikey",
  "creditcard",
  "cardnumber",
  "cvv",
  "cvc",
  "ssn"
]);
function maskSensitiveData(data, customKeys) {
  if (data === null || data === void 0) return data;
  if (typeof data !== "object") return data;
  const sensitiveSet = customKeys ? /* @__PURE__ */ new Set([...DEFAULT_SENSITIVE_KEYS, ...customKeys.map((k) => k.toLowerCase())]) : DEFAULT_SENSITIVE_KEYS;
  if (Array.isArray(data)) {
    return data.map((item) => maskSensitiveData(item, customKeys));
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase().replace(/[-_]/g, "");
    if (sensitiveSet.has(lowerKey)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = maskSensitiveData(value, customKeys);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// src/audit.ts
var MemoryAuditRepository = class {
  events = [];
  async save(event) {
    this.events.unshift(event);
  }
  async findRecent(limit = 50) {
    return this.events.slice(0, limit);
  }
  async findByTarget(resource, targetId) {
    return this.events.filter(
      (e) => e.resource === resource && e.targetId === targetId
    );
  }
  clear() {
    this.events = [];
  }
};
var ConsoleAuditRepository = class {
  async save(event) {
    console.log("[AUDIT_LOG]", JSON.stringify(event));
  }
  async findRecent() {
    return [];
  }
  async findByTarget() {
    return [];
  }
};
var PrismaAuditRepository = class {
  constructor(prismaClient) {
    this.prismaClient = prismaClient;
  }
  prismaClient;
  async save(event) {
    if (!this.prismaClient?.auditLog) {
      throw new Error("Prisma client does not have an auditLog model configured");
    }
    await this.prismaClient.auditLog.create({
      data: {
        actorId: event.actor?.id,
        actorType: event.actor?.type || "user",
        action: event.action,
        resource: event.resource,
        targetId: event.targetId,
        status: event.status || "SUCCESS",
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        oldValues: event.oldValues ? JSON.stringify(event.oldValues) : null,
        newValues: event.newValues ? JSON.stringify(event.newValues) : null,
        metadata: event.metadata ? JSON.stringify(event.metadata) : null,
        timestamp: event.timestamp
      }
    });
  }
  async findRecent(limit = 50) {
    if (!this.prismaClient?.auditLog) return [];
    const rows = await this.prismaClient.auditLog.findMany({
      take: limit,
      orderBy: { timestamp: "desc" }
    });
    return rows.map((r) => ({
      id: r.id,
      actor: { id: r.actorId, type: r.actorType },
      action: r.action,
      resource: r.resource,
      targetId: r.targetId,
      status: r.status,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      oldValues: r.oldValues ? JSON.parse(r.oldValues) : void 0,
      newValues: r.newValues ? JSON.parse(r.newValues) : void 0,
      metadata: r.metadata ? JSON.parse(r.metadata) : void 0,
      timestamp: r.timestamp
    }));
  }
  async findByTarget(resource, targetId) {
    if (!this.prismaClient?.auditLog) return [];
    const rows = await this.prismaClient.auditLog.findMany({
      where: { resource, targetId },
      orderBy: { timestamp: "desc" }
    });
    return rows.map((r) => ({
      id: r.id,
      actor: { id: r.actorId, type: r.actorType },
      action: r.action,
      resource: r.resource,
      targetId: r.targetId,
      status: r.status,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      oldValues: r.oldValues ? JSON.parse(r.oldValues) : void 0,
      newValues: r.newValues ? JSON.parse(r.newValues) : void 0,
      metadata: r.metadata ? JSON.parse(r.metadata) : void 0,
      timestamp: r.timestamp
    }));
  }
};
var AuditService = class {
  constructor(repository = new MemoryAuditRepository()) {
    this.repository = repository;
  }
  repository;
  async record(input) {
    const record = {
      ...input,
      id: Math.random().toString(36).substring(2, 15) + Date.now().toString(36),
      oldValues: maskSensitiveData(input.oldValues),
      newValues: maskSensitiveData(input.newValues),
      metadata: maskSensitiveData(input.metadata),
      status: input.status || "SUCCESS",
      timestamp: /* @__PURE__ */ new Date()
    };
    try {
      await this.repository.save(record);
    } catch (err) {
      console.error("[AuditService] Failed to persist audit record:", err);
    }
    return record;
  }
  async getRecent(limit) {
    return this.repository.findRecent(limit);
  }
  async getForTarget(resource, targetId) {
    return this.repository.findByTarget(resource, targetId);
  }
};

// src/express.ts
var crypto = __toESM(require("crypto"));
function createHttpLoggerMiddleware(options = {}) {
  const loggerInstance = options.logger || defaultLogger;
  const audit = options.auditService;
  const headerName = options.headerName || "x-request-id";
  const autoAudit = options.autoAudit ?? true;
  const defaultExcludes = ["/health", "/docs", "/favicon.ico"];
  const excludeAuditPaths = options.excludeAuditPaths ? [...defaultExcludes, ...options.excludeAuditPaths] : defaultExcludes;
  return (req, res, next) => {
    const startTime = process.hrtime();
    const incomingId = req.headers[headerName.toLowerCase()];
    const requestId = typeof incomingId === "string" && incomingId.trim().length > 0 ? incomingId : crypto.randomUUID();
    req.id = requestId;
    res.setHeader(headerName, requestId);
    const scopedLogger = loggerInstance.child({
      requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip
    });
    req.logger = scopedLogger;
    if (audit) {
      req.audit = (event) => {
        const actor = req.user ? { id: String(req.user.id || req.user.sub), email: req.user.email } : event.actor;
        return audit.record({
          ...event,
          actor,
          ipAddress: req.ip,
          userAgent: req.get("user-agent")
        });
      };
    }
    res.on("finish", () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationMs = Math.round((seconds * 1e3 + nanoseconds / 1e6) * 100) / 100;
      const logData = {
        statusCode: res.statusCode,
        durationMs
      };
      if (options.logBody && req.body && Object.keys(req.body).length > 0) {
        logData.body = maskSensitiveData(req.body);
      }
      if (res.statusCode >= 500) {
        scopedLogger.error({ ...logData }, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`);
      } else if (res.statusCode >= 400) {
        scopedLogger.warn({ ...logData }, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`);
      } else {
        scopedLogger.info({ ...logData }, `HTTP ${req.method} ${req.originalUrl || req.url} ${res.statusCode} - ${durationMs}ms`);
      }
      if (audit && autoAudit) {
        const url = req.originalUrl || req.url;
        const isExcluded = excludeAuditPaths.some((excludePath) => url.startsWith(excludePath));
        if (!isExcluded) {
          const user = req.user;
          const actor = user ? { id: String(user.id || user.sub), email: user.email } : void 0;
          audit.record({
            actor,
            action: `HTTP_${req.method.toUpperCase()}`,
            resource: req.baseUrl || req.path || url.split("?")[0] || "HTTP",
            targetId: req.id,
            status: res.statusCode >= 400 ? "FAILURE" : "SUCCESS",
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
            newValues: options.logBody && req.body && Object.keys(req.body).length > 0 ? maskSensitiveData(req.body) : void 0,
            metadata: {
              method: req.method,
              url,
              statusCode: res.statusCode,
              durationMs
            }
          }).catch((err) => {
            scopedLogger.warn({ err }, "Failed to record auto-audit log");
          });
        }
      }
    });
    next();
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AppLogger,
  AuditService,
  ConsoleAuditRepository,
  MemoryAuditRepository,
  PrismaAuditRepository,
  createHttpLoggerMiddleware,
  defaultLogger,
  maskSensitiveData
});
