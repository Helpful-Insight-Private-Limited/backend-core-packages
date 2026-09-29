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
  AwsSesMailProvider: () => AwsSesMailProvider,
  DevMemoryMailProvider: () => DevMemoryMailProvider,
  MailService: () => MailService,
  MailgunMailProvider: () => MailgunMailProvider,
  SendGridMailProvider: () => SendGridMailProvider,
  SmtpMailProvider: () => SmtpMailProvider
});
module.exports = __toCommonJS(index_exports);

// src/providers/memory.ts
var DevMemoryMailProvider = class {
  name = "memory";
  sentEmails = [];
  async sendMail(options) {
    const id = `mem-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    const record = {
      ...options,
      id,
      sentAt: /* @__PURE__ */ new Date()
    };
    this.sentEmails.push(record);
    return {
      success: true,
      messageId: id,
      provider: this.name
    };
  }
  getSentEmails() {
    return [...this.sentEmails];
  }
  getLastEmail() {
    return this.sentEmails[this.sentEmails.length - 1];
  }
  clear() {
    this.sentEmails = [];
  }
};

// src/service.ts
var MailService = class _MailService {
  primaryProvider;
  fallbackProvider;
  defaultFrom;
  maxRetries;
  constructor(config) {
    this.primaryProvider = config.provider;
    this.fallbackProvider = config.fallbackProvider;
    this.defaultFrom = config.defaultFrom;
    this.maxRetries = config.maxRetries ?? 2;
  }
  static createWithMemory() {
    const memory = new DevMemoryMailProvider();
    const service = new _MailService({
      provider: memory,
      defaultFrom: "no-reply@example.com"
    });
    return { service, memoryProvider: memory };
  }
  async send(options) {
    const mailOptions = {
      ...options,
      from: options.from || this.defaultFrom
    };
    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.primaryProvider.sendMail(mailOptions);
        if (result.success) {
          return result;
        }
        lastError = result.error;
      } catch (err) {
        lastError = err.message;
      }
      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(2, attempt)));
      }
    }
    if (this.fallbackProvider) {
      try {
        const fallbackResult = await this.fallbackProvider.sendMail(mailOptions);
        if (fallbackResult.success) {
          return fallbackResult;
        }
        lastError = `Primary failed (${lastError}). Fallback failed (${fallbackResult.error})`;
      } catch (err) {
        lastError = `Primary failed (${lastError}). Fallback error: ${err.message}`;
      }
    }
    return {
      success: false,
      provider: this.primaryProvider.name,
      error: lastError || "All mail sending attempts failed"
    };
  }
};

// src/providers/smtp.ts
var import_nodemailer = __toESM(require("nodemailer"));
var SmtpMailProvider = class {
  name = "smtp";
  transporter;
  defaultFrom;
  constructor(config) {
    this.defaultFrom = config.from;
    this.transporter = import_nodemailer.default.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: config.auth,
      tls: config.tls
    });
  }
  async sendMail(options) {
    try {
      const info = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        cc: Array.isArray(options.cc) ? options.cc.join(", ") : options.cc,
        bcc: Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          path: a.path,
          contentType: a.contentType
        })),
        headers: options.headers
      });
      return {
        success: true,
        messageId: info.messageId,
        provider: this.name
      };
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err.message || "SMTP delivery failed"
      };
    }
  }
  async verifyConnection() {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
};

// src/providers/ses.ts
var import_nodemailer2 = __toESM(require("nodemailer"));
var AwsSesMailProvider = class {
  name = "aws-ses";
  transporter;
  defaultFrom;
  constructor(config) {
    this.defaultFrom = config.from;
    const host = config.smtpHost || `email-smtp.${config.region}.amazonaws.com`;
    const port = config.smtpPort || 465;
    this.transporter = import_nodemailer2.default.createTransport({
      host,
      port,
      secure: port === 465,
      auth: config.accessKeyId && config.secretAccessKey ? {
        user: config.accessKeyId,
        pass: config.secretAccessKey
      } : void 0
    });
  }
  async sendMail(options) {
    try {
      const info = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        cc: Array.isArray(options.cc) ? options.cc.join(", ") : options.cc,
        bcc: Array.isArray(options.bcc) ? options.bcc.join(", ") : options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          path: a.path,
          contentType: a.contentType
        })),
        headers: options.headers
      });
      return {
        success: true,
        messageId: info.messageId,
        provider: this.name
      };
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err.message || "AWS SES delivery failed"
      };
    }
  }
};

// src/providers/sendgrid.ts
var SendGridMailProvider = class {
  name = "sendgrid";
  apiKey;
  defaultFrom;
  constructor(config) {
    this.apiKey = config.apiKey;
    this.defaultFrom = config.from;
  }
  async sendMail(options) {
    try {
      const fromEmail = options.from || this.defaultFrom;
      if (!fromEmail) {
        return { success: false, provider: this.name, error: "From email is required" };
      }
      const toList = Array.isArray(options.to) ? options.to : [options.to];
      const personalizations = [
        {
          to: toList.map((email) => ({ email: email.trim() }))
        }
      ];
      if (options.cc) {
        const ccList = Array.isArray(options.cc) ? options.cc : [options.cc];
        personalizations[0].cc = ccList.map((email) => ({ email: email.trim() }));
      }
      if (options.bcc) {
        const bccList = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
        personalizations[0].bcc = bccList.map((email) => ({ email: email.trim() }));
      }
      const content = [];
      if (options.text) {
        content.push({ type: "text/plain", value: options.text });
      }
      if (options.html) {
        content.push({ type: "text/html", value: options.html });
      }
      if (content.length === 0) {
        content.push({ type: "text/plain", value: "" });
      }
      const bodyPayload = {
        personalizations,
        from: { email: fromEmail },
        subject: options.subject,
        content
      };
      if (options.replyTo) {
        bodyPayload.reply_to = { email: options.replyTo };
      }
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(bodyPayload)
      });
      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: this.name,
          error: `SendGrid API error (${response.status}): ${errText}`
        };
      }
      const messageId = response.headers.get("x-message-id") || `sg-${Date.now()}`;
      return {
        success: true,
        messageId,
        provider: this.name
      };
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err.message || "SendGrid request failed"
      };
    }
  }
};

// src/providers/mailgun.ts
var MailgunMailProvider = class {
  name = "mailgun";
  apiKey;
  domain;
  baseUrl;
  defaultFrom;
  constructor(config) {
    this.apiKey = config.apiKey;
    this.domain = config.domain;
    this.defaultFrom = config.from;
    const host = config.region === "eu" ? "api.eu.mailgun.net" : "api.mailgun.net";
    this.baseUrl = `https://${host}/v3/${this.domain}/messages`;
  }
  async sendMail(options) {
    try {
      const fromEmail = options.from || this.defaultFrom;
      if (!fromEmail) {
        return { success: false, provider: this.name, error: "From email is required" };
      }
      const params = new URLSearchParams();
      params.append("from", fromEmail);
      const toList = Array.isArray(options.to) ? options.to.join(",") : options.to;
      params.append("to", toList);
      if (options.cc) {
        const ccList = Array.isArray(options.cc) ? options.cc.join(",") : options.cc;
        params.append("cc", ccList);
      }
      if (options.bcc) {
        const bccList = Array.isArray(options.bcc) ? options.bcc.join(",") : options.bcc;
        params.append("bcc", bccList);
      }
      params.append("subject", options.subject);
      if (options.text) {
        params.append("text", options.text);
      }
      if (options.html) {
        params.append("html", options.html);
      }
      if (options.replyTo) {
        params.append("h:Reply-To", options.replyTo);
      }
      const authHeader = `Basic ${Buffer.from(`api:${this.apiKey}`).toString("base64")}`;
      const response = await fetch(this.baseUrl, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: params.toString()
      });
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          provider: this.name,
          error: `Mailgun API error (${response.status}): ${errorText}`
        };
      }
      const result = await response.json();
      return {
        success: true,
        messageId: result.id || `mg-${Date.now()}`,
        provider: this.name
      };
    } catch (err) {
      return {
        success: false,
        provider: this.name,
        error: err.message || "Mailgun request failed"
      };
    }
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  AwsSesMailProvider,
  DevMemoryMailProvider,
  MailService,
  MailgunMailProvider,
  SendGridMailProvider,
  SmtpMailProvider
});
