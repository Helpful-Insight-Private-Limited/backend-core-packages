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
  GithubOAuthHelper: () => GithubOAuthHelper,
  GoogleOAuthHelper: () => GoogleOAuthHelper,
  JwtService: () => JwtService,
  MemoryAuthUserStore: () => MemoryAuthUserStore,
  MemorySessionStore: () => MemorySessionStore,
  PRISMA_AUTH_SCHEMA_SNIPPET: () => PRISMA_AUTH_SCHEMA_SNIPPET,
  PasswordHash: () => PasswordHash,
  PrismaAuthUserStore: () => PrismaAuthUserStore,
  PrismaSessionStore: () => PrismaSessionStore,
  TotpService: () => TotpService,
  createAuthMiddleware: () => createAuthMiddleware,
  createAuthRouter: () => createAuthRouter
});
module.exports = __toCommonJS(index_exports);

// src/password.ts
var import_bcryptjs = __toESM(require("bcryptjs"));
var PasswordHash = class {
  static async hash(plainPassword, rounds = 12) {
    const salt = await import_bcryptjs.default.genSalt(rounds);
    return import_bcryptjs.default.hash(plainPassword, salt);
  }
  static async compare(plainPassword, hash) {
    if (!plainPassword || !hash) return false;
    return import_bcryptjs.default.compare(plainPassword, hash);
  }
};

// src/jwt.ts
var import_jsonwebtoken = __toESM(require("jsonwebtoken"));
var JwtService = class {
  accessSecret;
  refreshSecret;
  accessExpiresIn;
  refreshExpiresIn;
  issuer;
  audience;
  constructor(options) {
    this.accessSecret = options.accessSecret;
    this.refreshSecret = options.refreshSecret || options.accessSecret;
    this.accessExpiresIn = options.accessExpiresIn || "15m";
    this.refreshExpiresIn = options.refreshExpiresIn || "7d";
    this.issuer = options.issuer;
    this.audience = options.audience;
  }
  generateAccessToken(payload, customExpiresIn) {
    const options = {
      expiresIn: customExpiresIn || this.accessExpiresIn
    };
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return import_jsonwebtoken.default.sign(payload, this.accessSecret, options);
  }
  generateRefreshToken(payload, customExpiresIn) {
    const options = {
      expiresIn: customExpiresIn || this.refreshExpiresIn
    };
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return import_jsonwebtoken.default.sign(payload, this.refreshSecret, options);
  }
  generateTokenPair(payload) {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      sub: payload.sub,
      sessionId: payload.sessionId
    });
    return {
      accessToken,
      refreshToken,
      expiresInSeconds: 15 * 60
      // 15 mins default
    };
  }
  verifyAccessToken(token) {
    const options = {};
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return import_jsonwebtoken.default.verify(token, this.accessSecret, options);
  }
  verifyRefreshToken(token) {
    const options = {};
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return import_jsonwebtoken.default.verify(token, this.refreshSecret, options);
  }
};

// src/totp.ts
var crypto = __toESM(require("crypto"));
var BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
var TotpService = class {
  /**
   * Generate a random base32 encoded secret for Google Authenticator.
   */
  static generateSecret(byteLength = 20) {
    const randomBytes2 = crypto.randomBytes(byteLength);
    let secret = "";
    let buffer = 0;
    let bitsLeft = 0;
    for (let i = 0; i < randomBytes2.length; i++) {
      buffer = buffer << 8 | randomBytes2[i];
      bitsLeft += 8;
      while (bitsLeft >= 5) {
        secret += BASE32_ALPHABET[buffer >> bitsLeft - 5 & 31];
        bitsLeft -= 5;
      }
    }
    if (bitsLeft > 0) {
      secret += BASE32_ALPHABET[buffer << 5 - bitsLeft & 31];
    }
    return secret;
  }
  /**
   * Decode base32 secret to Buffer.
   */
  static base32Decode(secret) {
    const cleaned = secret.toUpperCase().replace(/=+$/, "").replace(/\s+/g, "");
    let buffer = 0;
    let bitsLeft = 0;
    const output = [];
    for (let i = 0; i < cleaned.length; i++) {
      const val = BASE32_ALPHABET.indexOf(cleaned[i]);
      if (val === -1) continue;
      buffer = buffer << 5 | val;
      bitsLeft += 5;
      if (bitsLeft >= 8) {
        output.push(buffer >> bitsLeft - 8 & 255);
        bitsLeft -= 8;
      }
    }
    return Buffer.from(output);
  }
  /**
   * Generate 6-digit TOTP token for given time (RFC 6238).
   */
  static generateToken(secret, timestampMs = Date.now(), timeStepSec = 30) {
    const key = this.base32Decode(secret);
    const counter = Math.floor(timestampMs / 1e3 / timeStepSec);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);
    const hmac = crypto.createHmac("sha1", key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();
    const offset = digest[digest.length - 1] & 15;
    const code = (digest[offset] & 127) << 24 | (digest[offset + 1] & 255) << 16 | (digest[offset + 2] & 255) << 8 | digest[offset + 3] & 255;
    const token = (code % 1e6).toString().padStart(6, "0");
    return token;
  }
  /**
   * Verify token with ±1 window tolerance (60s total window).
   */
  static verifyToken(token, secret, options = {}) {
    if (!token || token.length !== 6) return false;
    const window = options.window ?? 1;
    const timeStepSec = options.timeStepSec ?? 30;
    const currentMs = options.timestampMs ?? Date.now();
    for (let offset = -window; offset <= window; offset++) {
      const checkMs = currentMs + offset * timeStepSec * 1e3;
      const expected = this.generateToken(secret, checkMs, timeStepSec);
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
        return true;
      }
    }
    return false;
  }
  /**
   * Build the otpauth URI for QR codes.
   */
  static getOtpAuthUri(options) {
    const label = encodeURIComponent(`${options.issuer}:${options.accountName}`);
    const issuerParam = encodeURIComponent(options.issuer);
    return `otpauth://totp/${label}?secret=${options.secret}&issuer=${issuerParam}&algorithm=SHA1&digits=6&period=30`;
  }
  /**
   * Generate emergency recovery backup codes (e.g. 10 codes).
   */
  static generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString("hex").toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }
};

// src/oauth.ts
var GoogleOAuthHelper = class {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }
  clientId;
  clientSecret;
  redirectUri;
  getAuthorizationUrl(state, scopes = ["email", "profile"]) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      access_type: "offline",
      prompt: "consent"
    });
    if (state) params.append("state", state);
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }
  async exchangeCode(code) {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: "authorization_code"
      }).toString()
    });
    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
    }
    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    if (!userRes.ok) {
      throw new Error(`Google user profile fetch failed: ${await userRes.text()}`);
    }
    const userData = await userRes.json();
    return {
      provider: "google",
      providerId: userData.sub,
      email: userData.email,
      name: userData.name,
      avatarUrl: userData.picture
    };
  }
};
var GithubOAuthHelper = class {
  constructor(clientId, clientSecret, redirectUri) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.redirectUri = redirectUri;
  }
  clientId;
  clientSecret;
  redirectUri;
  getAuthorizationUrl(state, scopes = ["read:user", "user:email"]) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(" ")
    });
    if (state) params.append("state", state);
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }
  async exchangeCode(code) {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri
      })
    });
    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${await tokenRes.text()}`);
    }
    const tokenData = await tokenRes.json();
    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error}`);
    }
    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "node-express-auth"
      }
    });
    const userData = await userRes.json();
    let email = userData.email;
    if (!email) {
      const emailsRes = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          "User-Agent": "node-express-auth"
        }
      });
      const emails = await emailsRes.json();
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary ? primary.email : emails[0]?.email;
    }
    return {
      provider: "github",
      providerId: String(userData.id),
      email: email || "",
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url
    };
  }
};

// src/sessions.ts
var MemorySessionStore = class {
  tokens = /* @__PURE__ */ new Map();
  async saveRefreshToken(userId, token, expiresAt, deviceInfo) {
    const item = {
      id: Math.random().toString(36).substring(2, 10),
      token,
      userId,
      expiresAt,
      isRevoked: false,
      deviceInfo,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.tokens.set(token, item);
    return item;
  }
  async findRefreshToken(token) {
    const item = this.tokens.get(token);
    if (!item) return null;
    if (item.isRevoked || item.expiresAt < /* @__PURE__ */ new Date()) {
      return null;
    }
    return { ...item };
  }
  async rotateRefreshToken(oldToken, newToken, newExpiresAt) {
    const existing = this.tokens.get(oldToken);
    if (!existing || existing.isRevoked) {
      if (existing) {
        await this.revokeAllUserSessions(existing.userId);
      }
      return null;
    }
    existing.isRevoked = true;
    this.tokens.set(oldToken, existing);
    return this.saveRefreshToken(existing.userId, newToken, newExpiresAt, existing.deviceInfo);
  }
  async revokeRefreshToken(token) {
    const item = this.tokens.get(token);
    if (item) {
      item.isRevoked = true;
      return true;
    }
    return false;
  }
  async revokeAllUserSessions(userId) {
    let count = 0;
    for (const [key, val] of this.tokens.entries()) {
      if (val.userId === userId && !val.isRevoked) {
        val.isRevoked = true;
        count++;
      }
    }
    return count;
  }
};
var PrismaSessionStore = class {
  constructor(prisma) {
    this.prisma = prisma;
  }
  prisma;
  async saveRefreshToken(userId, token, expiresAt, deviceInfo) {
    if (!this.prisma?.refreshToken) {
      throw new Error("Prisma client does not have refreshToken model");
    }
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        token,
        expiresAt,
        deviceInfo
      }
    });
    return record;
  }
  async findRefreshToken(token) {
    if (!this.prisma?.refreshToken) return null;
    return this.prisma.refreshToken.findUnique({
      where: { token }
    });
  }
  async rotateRefreshToken(oldToken, newToken, newExpiresAt) {
    if (!this.prisma?.refreshToken) return null;
    const existing = await this.prisma.refreshToken.findUnique({
      where: { token: oldToken }
    });
    if (!existing || existing.isRevoked || existing.expiresAt < /* @__PURE__ */ new Date()) {
      if (existing) {
        await this.revokeAllUserSessions(existing.userId);
      }
      return null;
    }
    await this.prisma.refreshToken.update({
      where: { token: oldToken },
      data: { isRevoked: true }
    });
    return this.saveRefreshToken(existing.userId, newToken, newExpiresAt, existing.deviceInfo);
  }
  async revokeRefreshToken(token) {
    if (!this.prisma?.refreshToken) return false;
    try {
      await this.prisma.refreshToken.update({
        where: { token },
        data: { isRevoked: true }
      });
      return true;
    } catch {
      return false;
    }
  }
  async revokeAllUserSessions(userId) {
    if (!this.prisma?.refreshToken) return 0;
    const res = await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true }
    });
    return res.count;
  }
};

// src/user-store.ts
var MemoryAuthUserStore = class {
  users = /* @__PURE__ */ new Map();
  async findByEmail(email) {
    const lower = email.toLowerCase();
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === lower) return { ...u };
    }
    return null;
  }
  async findById(id) {
    const u = this.users.get(id);
    return u ? { ...u } : null;
  }
  async create(data) {
    const id = `usr_${Math.random().toString(36).substring(2, 10)}`;
    const user = {
      id,
      email: data.email.toLowerCase(),
      passwordHash: data.passwordHash,
      name: data.name,
      phone: data.phone,
      roles: data.role ? [data.role] : ["viewer"],
      isMfaEnabled: false
    };
    this.users.set(id, user);
    return { ...user };
  }
  async updatePassword(userId, newPasswordHash) {
    const u = this.users.get(userId);
    if (u) {
      u.passwordHash = newPasswordHash;
    }
  }
  async updateMfa(userId, data) {
    const u = this.users.get(userId);
    if (u) {
      if (data.isMfaEnabled !== void 0) u.isMfaEnabled = data.isMfaEnabled;
      if (data.mfaSecret !== void 0) u.mfaSecret = data.mfaSecret;
      if (data.mfaBackupCodes !== void 0) u.mfaBackupCodes = data.mfaBackupCodes;
    }
  }
};
var PrismaAuthUserStore = class {
  constructor(prisma) {
    this.prisma = prisma;
  }
  prisma;
  async findByEmail(email) {
    if (!this.prisma?.user) return null;
    const row = await this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { roles: { include: { role: true } } }
    });
    if (!row) return null;
    return this.mapPrismaUser(row);
  }
  async findById(id) {
    if (!this.prisma?.user) return null;
    const row = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } }
    });
    if (!row) return null;
    return this.mapPrismaUser(row);
  }
  async create(data) {
    if (!this.prisma?.user) throw new Error("Prisma user model is missing");
    const roleName = data.role || "viewer";
    let role = await this.prisma.role?.findUnique({ where: { name: roleName } });
    if (!role && this.prisma.role) {
      role = await this.prisma.role.create({
        data: { name: roleName, description: `${roleName} role` }
      });
    }
    const row = await this.prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
        phone: data.phone,
        ...role ? {
          roles: {
            create: { roleId: role.id }
          }
        } : {}
      },
      include: { roles: { include: { role: true } } }
    });
    return this.mapPrismaUser(row);
  }
  async updatePassword(userId, newPasswordHash) {
    if (!this.prisma?.user) return;
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newPasswordHash }
    });
  }
  async updateMfa(userId, data) {
    if (!this.prisma?.user) return;
    await this.prisma.user.update({
      where: { id: userId },
      data
    });
  }
  mapPrismaUser(row) {
    const roles = Array.isArray(row.roles) ? row.roles.map((r) => r.role?.name || r.roleName || "").filter(Boolean) : [];
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      name: row.name,
      phone: row.phone,
      roles,
      isMfaEnabled: row.isMfaEnabled,
      mfaSecret: row.mfaSecret,
      mfaBackupCodes: row.mfaBackupCodes
    };
  }
};

// src/router.ts
var import_express = require("express");

// src/express.ts
function createAuthMiddleware(jwtService, defaultOptions = {}) {
  const authenticateJwt = (options = {}) => {
    const opts = { ...defaultOptions, ...options };
    return (req, res, next) => {
      let token;
      if (opts.getToken) {
        token = opts.getToken(req);
      } else if (req.headers.authorization) {
        const parts = req.headers.authorization.split(" ");
        if (parts.length === 2 && parts[0].toLowerCase() === "bearer") {
          token = parts[1];
        }
      }
      if (!token) {
        if (opts.allowAnonymous) {
          return next();
        }
        res.status(401).json({
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Authentication token missing or invalid Bearer format"
          }
        });
        return;
      }
      try {
        const payload = jwtService.verifyAccessToken(token);
        req.user = payload;
        next();
      } catch (err) {
        if (opts.allowAnonymous) {
          return next();
        }
        res.status(401).json({
          success: false,
          error: {
            code: "TOKEN_EXPIRED_OR_INVALID",
            message: err.message || "Token is invalid or has expired"
          }
        });
      }
    };
  };
  const requireMfaVerification = () => {
    return (req, res, next) => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication required" }
        });
        return;
      }
      if (req.user.isMfaEnabled && !req.user.isMfaVerified) {
        res.status(403).json({
          success: false,
          error: {
            code: "MFA_REQUIRED",
            message: "Two-Factor Authentication verification is required to access this resource"
          }
        });
        return;
      }
      next();
    };
  };
  return {
    authenticateJwt,
    requireMfaVerification
  };
}

// src/router.ts
var import_validator = require("@rohit-jain11/validator");
function createAuthRouter(options) {
  const router = (0, import_express.Router)();
  const store = options.userStore || (options.prisma ? new PrismaAuthUserStore(options.prisma) : new MemoryAuthUserStore());
  const jwt2 = options.jwtService;
  const session = options.sessionStore;
  const defaultRole = options.defaultRole || "viewer";
  const resetUrlBase = options.resetPasswordUrl || "http://localhost:3000/reset-password";
  const resetTokenExpires = options.resetTokenExpiresIn || "15m";
  const { authenticateJwt } = createAuthMiddleware(jwt2);
  const sendSuccess = (res, data, statusCode = 200) => {
    res.status(statusCode).json({
      success: true,
      data,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  };
  const sendError = (res, code, message, statusCode = 400) => {
    res.status(statusCode).json({
      success: false,
      error: { code, message },
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  };
  const handleSignup = async (req, res) => {
    try {
      const { email, password, name, phone, role } = req.body;
      if (!email || typeof email !== "string") {
        return sendError(res, "INVALID_EMAIL", "A valid email address is required", 400);
      }
      const emailValidation = import_validator.EmailValidator.validate(email);
      if (!emailValidation.isValid) {
        return sendError(res, "INVALID_EMAIL", emailValidation.error || "A valid email address is required", 400);
      }
      if (phone) {
        const phoneValidation = import_validator.PhoneValidator.validate(String(phone));
        if (!phoneValidation.isValid) {
          return sendError(res, "INVALID_PHONE", phoneValidation.error || "Invalid phone number format", 400);
        }
      }
      if (!password || typeof password !== "string" || password.length < 8) {
        return sendError(
          res,
          "WEAK_PASSWORD",
          "Password must be at least 8 characters long",
          400
        );
      }
      const existing = await store.findByEmail(email);
      if (existing) {
        return sendError(
          res,
          "USER_EXISTS",
          "An account with this email already exists",
          409
        );
      }
      const passwordHash = await PasswordHash.hash(password);
      const user = await store.create({
        email,
        passwordHash,
        name,
        phone,
        role: role || defaultRole
      });
      const roles = user.roles || [defaultRole];
      const tokens = jwt2.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles
      });
      if (session) {
        await session.saveRefreshToken(
          user.id,
          tokens.refreshToken,
          new Date(Date.now() + 7 * 24 * 3600 * 1e3),
          req.get("user-agent")
        );
      }
      if (options.onUserRegistered) {
        try {
          await options.onUserRegistered(user, req);
        } catch (hookErr) {
          console.error("[createAuthRouter] onUserRegistered hook error:", hookErr);
        }
      }
      sendSuccess(
        res,
        {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            roles
          },
          tokens
        },
        201
      );
    } catch (err) {
      sendError(res, "SIGNUP_FAILED", err.message, 500);
    }
  };
  router.post("/signup", handleSignup);
  router.post("/register", handleSignup);
  router.post("/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return sendError(
          res,
          "MISSING_CREDENTIALS",
          "Both email and password are required",
          400
        );
      }
      const user = await store.findByEmail(email);
      if (!user || !user.passwordHash) {
        return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
      }
      const isMatch = await PasswordHash.compare(password, user.passwordHash);
      if (!isMatch) {
        return sendError(res, "INVALID_CREDENTIALS", "Invalid email or password", 401);
      }
      if (user.isMfaEnabled) {
        const tempToken = jwt2.generateAccessToken(
          { sub: user.id, email: user.email, isMfaVerified: false },
          "5m"
        );
        return sendSuccess(res, {
          mfaRequired: true,
          tempToken,
          message: "Two-Factor Authentication is enabled. Please submit 6-digit TOTP code."
        });
      }
      const roles = user.roles || [defaultRole];
      const tokens = jwt2.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles,
        isMfaVerified: true
      });
      if (session) {
        await session.saveRefreshToken(
          user.id,
          tokens.refreshToken,
          new Date(Date.now() + 7 * 24 * 3600 * 1e3),
          req.get("user-agent")
        );
      }
      if (options.onUserLoggedIn) {
        try {
          await options.onUserLoggedIn(user, req);
        } catch (hookErr) {
          console.error("[createAuthRouter] onUserLoggedIn hook error:", hookErr);
        }
      }
      sendSuccess(res, {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          roles
        },
        tokens
      });
    } catch (err) {
      sendError(res, "LOGIN_FAILED", err.message, 500);
    }
  });
  const handleForgotPassword = async (req, res) => {
    try {
      const { email } = req.body;
      if (!email || typeof email !== "string") {
        return sendError(res, "EMAIL_REQUIRED", "Email is required", 400);
      }
      const emailValidation = import_validator.EmailValidator.validate(email);
      if (!emailValidation.isValid) {
        return sendError(res, "INVALID_EMAIL", emailValidation.error || "A valid email address is required", 400);
      }
      const user = await store.findByEmail(email);
      if (!user) {
        return sendSuccess(res, {
          message: "If an account associated with this email exists, a password reset link has been sent."
        });
      }
      const resetToken = jwt2.generateAccessToken(
        {
          sub: user.id,
          email: user.email,
          purpose: "password_reset"
        },
        resetTokenExpires
      );
      const resetUrl = `${resetUrlBase}?token=${encodeURIComponent(resetToken)}`;
      if (options.onSendPasswordResetMail) {
        await options.onSendPasswordResetMail({
          to: user.email,
          subject: "Password Reset Request",
          resetUrl,
          resetToken,
          userName: user.name || void 0
        });
      }
      const responsePayload = {
        message: "If an account associated with this email exists, a password reset link has been sent."
      };
      if (process.env.NODE_ENV !== "production") {
        responsePayload.debug = { resetToken, resetUrl };
      }
      sendSuccess(res, responsePayload);
    } catch (err) {
      sendError(res, "FORGOT_PASSWORD_FAILED", err.message, 500);
    }
  };
  router.post("/forgot-password", handleForgotPassword);
  router.post("/forget", handleForgotPassword);
  const handleResetPassword = async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      if (!token || typeof token !== "string") {
        return sendError(res, "TOKEN_REQUIRED", "Reset token is required", 400);
      }
      if (!newPassword || typeof newPassword !== "string" || newPassword.length < 8) {
        return sendError(
          res,
          "WEAK_PASSWORD",
          "New password must be at least 8 characters long",
          400
        );
      }
      let payload;
      try {
        payload = jwt2.verifyAccessToken(token);
      } catch (tokenErr) {
        return sendError(
          res,
          "INVALID_RESET_TOKEN",
          "Password reset link is invalid or has expired. Please request a new one.",
          400
        );
      }
      if (payload.purpose !== "password_reset") {
        return sendError(
          res,
          "INVALID_RESET_TOKEN",
          "Token is not valid for password reset",
          400
        );
      }
      const user = await store.findById(payload.sub);
      if (!user) {
        return sendError(res, "USER_NOT_FOUND", "User does not exist", 404);
      }
      const newPasswordHash = await PasswordHash.hash(newPassword);
      await store.updatePassword(user.id, newPasswordHash);
      if (session) {
        await session.revokeAllUserSessions(user.id);
      }
      if (options.onPasswordReset) {
        try {
          await options.onPasswordReset(user, req);
        } catch (hookErr) {
          console.error("[createAuthRouter] onPasswordReset hook error:", hookErr);
        }
      }
      sendSuccess(res, {
        message: "Password has been successfully updated. You can now log in."
      });
    } catch (err) {
      sendError(res, "RESET_PASSWORD_FAILED", err.message, 500);
    }
  };
  router.post("/reset-password", handleResetPassword);
  router.post("/reset", handleResetPassword);
  router.post("/refresh", async (req, res) => {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken || typeof refreshToken !== "string") {
        return sendError(res, "TOKEN_REQUIRED", "Refresh token is required", 400);
      }
      const payload = jwt2.verifyRefreshToken(refreshToken);
      const user = await store.findById(payload.sub);
      if (!user) {
        return sendError(res, "USER_NOT_FOUND", "User not found", 404);
      }
      const roles = user.roles || [defaultRole];
      const newTokens = jwt2.generateTokenPair({
        sub: user.id,
        email: user.email,
        roles,
        isMfaVerified: true
      });
      if (session) {
        const rotated = await session.rotateRefreshToken(
          refreshToken,
          newTokens.refreshToken,
          new Date(Date.now() + 7 * 24 * 3600 * 1e3)
        );
        if (!rotated) {
          return sendError(
            res,
            "INVALID_REFRESH_TOKEN",
            "Refresh token was already used or revoked",
            403
          );
        }
      }
      sendSuccess(res, { tokens: newTokens });
    } catch (err) {
      sendError(res, "REFRESH_FAILED", err.message, 401);
    }
  });
  router.post("/logout", async (req, res) => {
    const { refreshToken } = req.body;
    if (session && refreshToken && typeof refreshToken === "string") {
      await session.revokeRefreshToken(refreshToken);
    }
    sendSuccess(res, { message: "Logged out successfully" });
  });
  router.get("/me", authenticateJwt(), async (req, res) => {
    const userId = req.user.sub;
    const user = await store.findById(userId);
    if (!user) {
      return sendError(res, "USER_NOT_FOUND", "User not found", 404);
    }
    sendSuccess(res, {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      roles: user.roles || [],
      isMfaEnabled: user.isMfaEnabled
    });
  });
  router.post("/mfa/setup", authenticateJwt(), async (req, res) => {
    const userId = req.user.sub;
    const secret = TotpService.generateSecret();
    const uri = TotpService.getOtpAuthUri({
      issuer: "EnterpriseAuth",
      accountName: req.user.email || userId,
      secret
    });
    const backupCodes = TotpService.generateBackupCodes(8);
    await store.updateMfa(userId, {
      mfaSecret: secret,
      mfaBackupCodes: JSON.stringify(backupCodes)
    });
    sendSuccess(res, {
      secret,
      otpAuthUri: uri,
      backupCodes,
      instructions: "Add secret to your authenticator app, then call /mfa/verify"
    });
  });
  router.post("/mfa/verify", authenticateJwt(), async (req, res) => {
    const userId = req.user.sub;
    const { token } = req.body;
    if (!token || typeof token !== "string") {
      return sendError(res, "TOKEN_REQUIRED", "6-digit TOTP code is required", 400);
    }
    const user = await store.findById(userId);
    if (!user?.mfaSecret) {
      return sendError(res, "MFA_NOT_SETUP", "Please call /mfa/setup first", 400);
    }
    const isValid = TotpService.verifyToken(token, user.mfaSecret);
    if (!isValid) {
      return sendError(
        res,
        "INVALID_MFA_TOKEN",
        "Verification code is incorrect or expired",
        400
      );
    }
    await store.updateMfa(userId, { isMfaEnabled: true });
    sendSuccess(res, { message: "Two-Factor Authentication is now enabled!" });
  });
  return router;
}

// src/prisma-schema.ts
var PRISMA_AUTH_SCHEMA_SNIPPET = `
model User {
  id              String         @id @default(uuid())
  email           String         @unique
  passwordHash    String?
  name            String?
  avatarUrl       String?
  isEmailVerified Boolean        @default(false)
  isMfaEnabled    Boolean        @default(false)
  mfaSecret       String?
  mfaBackupCodes  String?        // JSON array of strings
  googleId        String?        @unique
  githubId        String?        @unique
  refreshTokens   RefreshToken[]
  roles           UserRole[]
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
}

model RefreshToken {
  id         String   @id @default(uuid())
  token      String   @unique
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  deviceInfo String?
  isRevoked  Boolean  @default(false)
  expiresAt  DateTime
  createdAt  DateTime @default(now())
}
`;
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  GithubOAuthHelper,
  GoogleOAuthHelper,
  JwtService,
  MemoryAuthUserStore,
  MemorySessionStore,
  PRISMA_AUTH_SCHEMA_SNIPPET,
  PasswordHash,
  PrismaAuthUserStore,
  PrismaSessionStore,
  TotpService,
  createAuthMiddleware,
  createAuthRouter
});
