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
  EmailValidator: () => EmailValidator,
  PasswordValidator: () => PasswordValidator,
  PhoneValidator: () => PhoneValidator,
  validateRequest: () => validateRequest
});
module.exports = __toCommonJS(index_exports);

// src/email.ts
var RFC5322_REGEX = /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;
var COMMON_DISPOSABLE_DOMAINS = /* @__PURE__ */ new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "throwawaymail.com",
  "getairmail.com",
  "yopmail.com",
  "trashmail.com",
  "dispostable.com",
  "temp-mail.org",
  "fakeinbox.com"
]);
var COMMON_DOMAIN_TYPOS = {
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmaill.com": "gmail.com",
  "yaho.com": "yahoo.com",
  "yahooo.com": "yahoo.com",
  "hotmial.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outloo.com": "outlook.com",
  "outlok.com": "outlook.com",
  "iclud.com": "icloud.com",
  "protonmai.com": "protonmail.com"
};
var EmailValidator = class {
  static validate(email, options = { allowDisposable: false, checkTypo: true }) {
    if (!email || typeof email !== "string") {
      return { isValid: false, error: "Email must be a non-empty string" };
    }
    const trimmed = email.trim();
    if (trimmed.length > 254) {
      return { isValid: false, error: "Email exceeds maximum length of 254 characters" };
    }
    if (!RFC5322_REGEX.test(trimmed)) {
      return { isValid: false, error: "Invalid email address format" };
    }
    const parts = trimmed.split("@");
    if (parts.length !== 2) {
      return { isValid: false, error: "Email must contain exactly one @ symbol" };
    }
    const [localPart, domainPart] = parts;
    const lowerDomain = domainPart.toLowerCase();
    const normalizedEmail = `${localPart}@${lowerDomain}`;
    const isDisposable = COMMON_DISPOSABLE_DOMAINS.has(lowerDomain);
    if (!options.allowDisposable && isDisposable) {
      return {
        isValid: false,
        normalizedEmail,
        domain: lowerDomain,
        isDisposable: true,
        error: "Disposable email addresses are not allowed"
      };
    }
    let suggestion;
    if (options.checkTypo && COMMON_DOMAIN_TYPOS[lowerDomain]) {
      const suggestedDomain = COMMON_DOMAIN_TYPOS[lowerDomain];
      suggestion = `Did you mean ${localPart}@${suggestedDomain}?`;
    }
    return {
      isValid: true,
      normalizedEmail,
      domain: lowerDomain,
      isDisposable,
      suggestion
    };
  }
  static isValid(email, options) {
    return this.validate(email, options).isValid;
  }
};

// src/phone.ts
var import_libphonenumber_js = require("libphonenumber-js");
var PhoneValidator = class {
  /**
   * Validate any international phone number across all countries.
   * @param phoneNumber The raw phone number string (e.g. '+14155552671' or '4155552671')
   * @param defaultCountry Optional ISO 3166-1 alpha-2 country code (e.g. 'US', 'GB', 'IN', 'CA')
   */
  static validate(phoneNumber, defaultCountry) {
    if (!phoneNumber || typeof phoneNumber !== "string") {
      return { isValid: false, error: "Phone number must be a non-empty string" };
    }
    try {
      const parsed = (0, import_libphonenumber_js.parsePhoneNumberFromString)(phoneNumber, defaultCountry);
      if (!parsed) {
        return {
          isValid: false,
          error: "Could not parse phone number. Ensure it includes a country code (e.g. +1...) or provide a default country."
        };
      }
      const isValid = parsed.isValid();
      if (!isValid) {
        return {
          isValid: false,
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          error: `Phone number is invalid for country ${parsed.country || "unknown"}`
        };
      }
      return {
        isValid: true,
        country: parsed.country,
        countryCallingCode: parsed.countryCallingCode,
        nationalNumber: parsed.nationalNumber,
        numberType: parsed.getType(),
        formats: {
          e164: parsed.format("E.164"),
          international: parsed.format("INTERNATIONAL"),
          national: parsed.format("NATIONAL"),
          rfc3966: parsed.format("RFC3966")
        }
      };
    } catch (err) {
      return {
        isValid: false,
        error: err.message || "Failed to validate phone number"
      };
    }
  }
  static isValid(phoneNumber, defaultCountry) {
    return this.validate(phoneNumber, defaultCountry).isValid;
  }
  static formatE164(phoneNumber, defaultCountry) {
    const res = this.validate(phoneNumber, defaultCountry);
    return res.isValid && res.formats ? res.formats.e164 : null;
  }
};

// src/password.ts
var crypto = __toESM(require("crypto"));
var COMMON_PASSWORDS = /* @__PURE__ */ new Set([
  "password",
  "123456",
  "12345678",
  "123456789",
  "qwerty",
  "12345",
  "111111",
  "1234567",
  "dragon",
  "welcome",
  "admin",
  "admin123",
  "root",
  "password123",
  "iloveyou",
  "monkey",
  "sunshine",
  "master",
  "football",
  "charlie"
]);
var SEQUENCES = [
  "0123456789",
  "9876543210",
  "abcdefghijklmnopqrstuvwxyz",
  "qwertyuiop",
  "asdfghjkl",
  "zxcvbnm"
];
var PasswordValidator = class {
  static DEFAULT_POLICY = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommon: true,
    disallowSequences: true
  };
  static validate(password, customPolicy) {
    const policy = { ...this.DEFAULT_POLICY, ...customPolicy };
    const suggestions = [];
    const failedRules = [];
    if (!password || typeof password !== "string") {
      return {
        isValid: false,
        score: 0,
        scoreLabel: "very_weak",
        suggestions: ["Password must be a non-empty string"],
        failedRules: ["non_empty"]
      };
    }
    if (password.length < policy.minLength) {
      failedRules.push("min_length");
      suggestions.push(
        `Make your password at least ${policy.minLength} characters long (currently ${password.length}).`
      );
    }
    if (password.length > policy.maxLength) {
      failedRules.push("max_length");
      suggestions.push(`Password must not exceed ${policy.maxLength} characters.`);
    }
    const hasUpper = /[A-Z]/.test(password);
    if (policy.requireUppercase && !hasUpper) {
      failedRules.push("require_uppercase");
      suggestions.push("Include at least one uppercase letter (A-Z).");
    }
    const hasLower = /[a-z]/.test(password);
    if (policy.requireLowercase && !hasLower) {
      failedRules.push("require_lowercase");
      suggestions.push("Include at least one lowercase letter (a-z).");
    }
    const hasNumber = /[0-9]/.test(password);
    if (policy.requireNumbers && !hasNumber) {
      failedRules.push("require_numbers");
      suggestions.push("Include at least one number (0-9).");
    }
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (policy.requireSpecialChars && !hasSpecial) {
      failedRules.push("require_special_chars");
      suggestions.push("Include at least one special character (e.g. !@#$%^&*).");
    }
    if (policy.disallowCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
      failedRules.push("disallow_common");
      suggestions.push("This password is very common and easily guessed. Please choose a unique passphrase.");
    }
    if (policy.disallowSequences) {
      const lower = password.toLowerCase();
      for (const seq of SEQUENCES) {
        for (let i = 0; i <= seq.length - 4; i++) {
          const sub = seq.substring(i, i + 4);
          if (lower.includes(sub)) {
            failedRules.push("disallow_sequences");
            suggestions.push(`Avoid predictable sequences like "${sub}".`);
            break;
          }
        }
      }
    }
    let score = 0;
    if (password.length >= policy.minLength) score++;
    if (password.length >= 12) score++;
    const varietyCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (varietyCount >= 3) score++;
    if (varietyCount === 4 && password.length >= 14 && failedRules.length === 0) score++;
    if (failedRules.includes("disallow_common") || failedRules.includes("min_length")) {
      score = Math.min(score, 1);
    }
    score = Math.min(4, Math.max(0, score));
    const labels = [
      "very_weak",
      "weak",
      "fair",
      "good",
      "strong"
    ];
    return {
      isValid: failedRules.length === 0,
      score,
      scoreLabel: labels[score],
      suggestions,
      failedRules
    };
  }
  static isValid(password, customPolicy) {
    return this.validate(password, customPolicy).isValid;
  }
  /**
   * Generates a cryptographically secure random password meeting all policy criteria.
   */
  static generate(length = 16, customPolicy) {
    const policy = { ...this.DEFAULT_POLICY, ...customPolicy };
    const actualLength = Math.max(length, policy.minLength);
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowers = "abcdefghijkmnopqrstuvwxyz";
    const numbers = "23456789";
    const specials = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    let charPool = lowers;
    const requiredChars = [];
    if (policy.requireUppercase) {
      charPool += uppers;
      requiredChars.push(uppers[crypto.randomInt(0, uppers.length)]);
    }
    if (policy.requireLowercase) {
      requiredChars.push(lowers[crypto.randomInt(0, lowers.length)]);
    }
    if (policy.requireNumbers) {
      charPool += numbers;
      requiredChars.push(numbers[crypto.randomInt(0, numbers.length)]);
    }
    if (policy.requireSpecialChars) {
      charPool += specials;
      requiredChars.push(specials[crypto.randomInt(0, specials.length)]);
    }
    while (requiredChars.length < actualLength) {
      requiredChars.push(charPool[crypto.randomInt(0, charPool.length)]);
    }
    for (let i = requiredChars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [requiredChars[i], requiredChars[j]] = [requiredChars[j], requiredChars[i]];
    }
    return requiredChars.join("");
  }
};

// src/express.ts
function validateRequest(schema) {
  return (req, res, next) => {
    const errors = {};
    const validateSection = (data, rules, sectionName) => {
      if (!rules) return;
      const target = data || {};
      for (const [field, rule] of Object.entries(rules)) {
        const val = target[field];
        const fieldKey = `${sectionName}.${field}`;
        if (rule.required && (val === void 0 || val === null || val === "")) {
          errors[fieldKey] = errors[fieldKey] || [];
          errors[fieldKey].push(`Field '${field}' is required`);
          continue;
        }
        if (val === void 0 || val === null || val === "") {
          continue;
        }
        if (rule.email) {
          const opts = typeof rule.email === "object" ? rule.email : void 0;
          const result = EmailValidator.validate(String(val), opts);
          if (!result.isValid) {
            errors[fieldKey] = errors[fieldKey] || [];
            errors[fieldKey].push(result.error || "Invalid email address");
            if (result.suggestion) {
              errors[fieldKey].push(result.suggestion);
            }
          }
        }
        if (rule.phone) {
          const defaultCountry = typeof rule.phone === "object" ? rule.phone.defaultCountry : void 0;
          const result = PhoneValidator.validate(String(val), defaultCountry);
          if (!result.isValid) {
            errors[fieldKey] = errors[fieldKey] || [];
            errors[fieldKey].push(result.error || "Invalid phone number");
          }
        }
        if (rule.password) {
          const policy = typeof rule.password === "object" ? rule.password : void 0;
          const result = PasswordValidator.validate(String(val), policy);
          if (!result.isValid) {
            errors[fieldKey] = errors[fieldKey] || [];
            errors[fieldKey].push(...result.suggestions);
          }
        }
      }
    };
    validateSection(req.body, schema.body, "body");
    validateSection(req.query, schema.query, "query");
    validateSection(req.params, schema.params, "params");
    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_FAILED",
          message: "One or more fields failed validation",
          details: errors
        }
      });
      return;
    }
    next();
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  EmailValidator,
  PasswordValidator,
  PhoneValidator,
  validateRequest
});
