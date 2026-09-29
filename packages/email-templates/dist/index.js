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
  BASE_STYLE: () => BASE_STYLE,
  DEFAULT_TEMPLATES: () => DEFAULT_TEMPLATES,
  EmailTemplateEngine: () => EmailTemplateEngine,
  MemoryTemplateStore: () => MemoryTemplateStore,
  PrismaTemplateStore: () => PrismaTemplateStore,
  WRAPPER_HTML: () => WRAPPER_HTML,
  createTemplateRouter: () => createTemplateRouter
});
module.exports = __toCommonJS(index_exports);

// src/defaults.ts
var BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #1a202c;
  background-color: #f7fafc;
  margin: 0;
  padding: 0;
`;
var WRAPPER_HTML = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="${BASE_STYLE}">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f7fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 32px 40px; text-align: left;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 13px; color: #718096; text-align: center;">
              \xA9 {{year}} {{companyName}}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
var DEFAULT_TEMPLATES = [
  {
    name: "welcome",
    subject: "Welcome to {{companyName}}, {{userName}}!",
    description: "Sent when a new user signs up or is onboarded.",
    isSystem: true,
    variables: ["companyName", "userName", "actionUrl", "year"],
    html: WRAPPER_HTML(`
      <h2 style="color: #2b6cb0; margin-top: 0; font-size: 24px;">Welcome aboard, {{userName}}! \u{1F389}</h2>
      <p style="font-size: 16px; color: #4a5568;">
        We're thrilled to have you join us at <strong>{{companyName}}</strong>. Your account is now active and ready to go.
      </p>
      <div style="margin: 32px 0; text-align: center;">
        <a href="{{{actionUrl}}}" style="background-color: #3182ce; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          Get Started
        </a>
      </div>
      <p style="font-size: 14px; color: #718096;">
        If you have any questions, simply reply directly to this email.
      </p>
    `),
    text: "Welcome to {{companyName}}, {{userName}}!\n\nYour account is ready. Get started here: {{{actionUrl}}}"
  },
  {
    name: "forgot-password",
    subject: "Reset your password for {{companyName}}",
    description: "Sent when a user requests a password reset link.",
    isSystem: true,
    variables: ["companyName", "userName", "resetUrl", "expiryMinutes", "year"],
    html: WRAPPER_HTML(`
      <h2 style="color: #2d3748; margin-top: 0; font-size: 24px;">Password Reset Request \u{1F510}</h2>
      <p style="font-size: 16px; color: #4a5568;">
        Hello {{userName}}, we received a request to reset your password for your <strong>{{companyName}}</strong> account.
      </p>
      <div style="margin: 32px 0; text-align: center;">
        <a href="{{{resetUrl}}}" style="background-color: #e53e3e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          Reset My Password
        </a>
      </div>
      <p style="font-size: 14px; color: #718096;">
        This link will expire in <strong>{{expiryMinutes}} minutes</strong>. If you did not make this request, you can safely ignore this email.
      </p>
    `),
    text: "Hello {{userName}},\n\nReset your password here: {{{resetUrl}}}\nThis link expires in {{expiryMinutes}} minutes."
  },
  {
    name: "reset-success",
    subject: "Your {{companyName}} password was successfully changed",
    description: "Sent when password reset or update completes.",
    isSystem: true,
    variables: ["companyName", "userName", "year"],
    html: WRAPPER_HTML(`
      <h2 style="color: #38a169; margin-top: 0; font-size: 24px;">Password Successfully Changed \u2705</h2>
      <p style="font-size: 16px; color: #4a5568;">
        Hello {{userName}}, your password for <strong>{{companyName}}</strong> has been updated.
      </p>
      <p style="font-size: 14px; color: #e53e3e; background-color: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #e53e3e;">
        <strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.
      </p>
    `),
    text: "Hello {{userName}},\n\nYour password for {{companyName}} was successfully changed. If you did not perform this action, please contact support immediately."
  },
  {
    name: "verify-email",
    subject: "Verify your email address - {{companyName}}",
    description: "Sent to verify user email address with OTP and link.",
    isSystem: true,
    variables: ["companyName", "userName", "verifyUrl", "otpCode", "year"],
    html: WRAPPER_HTML(`
      <h2 style="color: #2b6cb0; margin-top: 0; font-size: 24px;">Verify Your Email Address \u2709\uFE0F</h2>
      <p style="font-size: 16px; color: #4a5568;">
        Hello {{userName}}, please use the verification code below to verify your email address:
      </p>
      <div style="margin: 24px 0; text-align: center;">
        <span style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #ebf8ff; color: #2b6cb0; padding: 12px 24px; border-radius: 8px; border: 1px dashed #3182ce;">
          {{otpCode}}
        </span>
      </div>
      <p style="text-align: center; font-size: 14px; color: #4a5568;">
        Or click the button below:
      </p>
      <div style="margin: 20px 0; text-align: center;">
        <a href="{{{verifyUrl}}}" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">
          Verify Email Now
        </a>
      </div>
    `),
    text: "Hello {{userName}},\n\nYour verification code is: {{otpCode}}\nOr verify via this link: {{{verifyUrl}}}"
  }
];

// src/engine.ts
var import_handlebars = __toESM(require("handlebars"));

// src/stores/memory.ts
var MemoryTemplateStore = class {
  templates = /* @__PURE__ */ new Map();
  constructor(loadDefaults = true) {
    if (loadDefaults) {
      for (const t of DEFAULT_TEMPLATES) {
        this.templates.set(t.name, { ...t, updatedAt: /* @__PURE__ */ new Date() });
      }
    }
  }
  async get(name) {
    const t = this.templates.get(name);
    return t ? { ...t } : null;
  }
  async save(template) {
    this.templates.set(template.name, {
      ...template,
      updatedAt: /* @__PURE__ */ new Date()
    });
  }
  async delete(name) {
    return this.templates.delete(name);
  }
  async list() {
    return Array.from(this.templates.values());
  }
};

// src/engine.ts
var EmailTemplateEngine = class {
  store;
  defaultVariables;
  constructor(options = {}) {
    this.store = options.store || new MemoryTemplateStore();
    this.defaultVariables = {
      companyName: "Our Application",
      year: (/* @__PURE__ */ new Date()).getFullYear(),
      ...options.defaultVariables
    };
  }
  getStore() {
    return this.store;
  }
  async render(templateName, variables = {}) {
    const template = await this.store.get(templateName);
    if (!template) {
      throw new Error(`Email template '${templateName}' not found`);
    }
    const mergedVars = {
      ...this.defaultVariables,
      ...variables
    };
    const subjectDelegate = import_handlebars.default.compile(template.subject);
    const subject = subjectDelegate(mergedVars);
    const htmlDelegate = import_handlebars.default.compile(template.html);
    const html = htmlDelegate(mergedVars);
    let text = "";
    if (template.text) {
      const textDelegate = import_handlebars.default.compile(template.text);
      text = textDelegate(mergedVars);
    } else {
      text = html.replace(/<[^>]*>?/gm, "").trim();
    }
    return {
      subject,
      html,
      text
    };
  }
  async saveTemplate(template) {
    await this.store.save(template);
  }
  async listTemplates() {
    return this.store.list();
  }
};

// src/stores/prisma.ts
var PrismaTemplateStore = class {
  constructor(prismaClient) {
    this.prismaClient = prismaClient;
  }
  prismaClient;
  async get(name) {
    if (this.prismaClient?.emailTemplate) {
      const record = await this.prismaClient.emailTemplate.findUnique({
        where: { name }
      });
      if (record) {
        return {
          name: record.name,
          subject: record.subject,
          html: record.html,
          text: record.text || void 0,
          variables: record.variables ? JSON.parse(record.variables) : [],
          description: record.description || void 0,
          isSystem: record.isSystem,
          updatedAt: record.updatedAt
        };
      }
    }
    const def = DEFAULT_TEMPLATES.find((t) => t.name === name);
    return def ? { ...def } : null;
  }
  async save(template) {
    if (!this.prismaClient?.emailTemplate) {
      throw new Error("Prisma client does not have emailTemplate model configured");
    }
    await this.prismaClient.emailTemplate.upsert({
      where: { name: template.name },
      update: {
        subject: template.subject,
        html: template.html,
        text: template.text,
        variables: template.variables ? JSON.stringify(template.variables) : null,
        description: template.description,
        isSystem: template.isSystem ?? false
      },
      create: {
        name: template.name,
        subject: template.subject,
        html: template.html,
        text: template.text,
        variables: template.variables ? JSON.stringify(template.variables) : null,
        description: template.description,
        isSystem: template.isSystem ?? false
      }
    });
  }
  async delete(name) {
    if (!this.prismaClient?.emailTemplate) return false;
    try {
      await this.prismaClient.emailTemplate.delete({ where: { name } });
      return true;
    } catch {
      return false;
    }
  }
  async list() {
    if (!this.prismaClient?.emailTemplate) return DEFAULT_TEMPLATES;
    const dbTemplates = await this.prismaClient.emailTemplate.findMany();
    const dbMap = /* @__PURE__ */ new Map();
    for (const record of dbTemplates) {
      dbMap.set(record.name, {
        name: record.name,
        subject: record.subject,
        html: record.html,
        text: record.text || void 0,
        variables: record.variables ? JSON.parse(record.variables) : [],
        description: record.description || void 0,
        isSystem: record.isSystem,
        updatedAt: record.updatedAt
      });
    }
    for (const def of DEFAULT_TEMPLATES) {
      if (!dbMap.has(def.name)) {
        dbMap.set(def.name, def);
      }
    }
    return Array.from(dbMap.values());
  }
};

// src/express.ts
var import_express = require("express");
function createTemplateRouter(engine) {
  const router = (0, import_express.Router)();
  router.get("/", async (_req, res) => {
    try {
      const templates = await engine.listTemplates();
      res.json({ success: true, data: templates });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.get("/:name", async (req, res) => {
    try {
      const templateName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const template = await engine.getStore().get(templateName);
      if (!template) {
        res.status(404).json({ success: false, error: "Template not found" });
        return;
      }
      res.json({ success: true, data: template });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.post("/", async (req, res) => {
    try {
      const { name, subject, html, text, variables, description } = req.body;
      if (!name || !subject || !html) {
        res.status(400).json({
          success: false,
          error: 'Fields "name", "subject", and "html" are required.'
        });
        return;
      }
      await engine.saveTemplate({
        name,
        subject,
        html,
        text,
        variables,
        description,
        isSystem: false
      });
      res.status(201).json({
        success: true,
        message: `Template '${name}' saved successfully.`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.delete("/:name", async (req, res) => {
    try {
      const templateName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const template = await engine.getStore().get(templateName);
      if (template?.isSystem) {
        res.status(403).json({ success: false, error: "Cannot delete system template" });
        return;
      }
      const deleted = await engine.getStore().delete(templateName);
      res.json({ success: true, deleted });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  router.get("/:name/preview", async (req, res) => {
    try {
      const templateName = Array.isArray(req.params.name) ? req.params.name[0] : req.params.name;
      const mockVars = {
        userName: "Alex Johnson",
        companyName: "Acme Corp",
        actionUrl: "https://example.com/start",
        resetUrl: "https://example.com/reset-password?token=sample_token",
        verifyUrl: "https://example.com/verify?token=sample_token",
        otpCode: "849201",
        expiryMinutes: 15,
        ...req.query
      };
      const rendered = await engine.render(templateName, mockVars);
      res.setHeader("Content-Type", "text/html");
      res.send(rendered.html);
    } catch (err) {
      res.status(404).send(`<h3>Error previewing template:</h3><p>${err.message}</p>`);
    }
  });
  return router;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  BASE_STYLE,
  DEFAULT_TEMPLATES,
  EmailTemplateEngine,
  MemoryTemplateStore,
  PrismaTemplateStore,
  WRAPPER_HTML,
  createTemplateRouter
});
