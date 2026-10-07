# @helpful-insight/validator

[![npm version](https://img.shields.io/npm/v/@helpful-insight/validator.svg)](https://www.npmjs.com/package/@helpful-insight/validator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Enterprise-grade, zero-compromise input validation package for **Node.js, Express, and modern JavaScript/TypeScript applications**. Provides multi-format validation for **RFC 5322 Email addresses**, **240+ Country Phone Numbers** (powered by full Google telecom metadata), and **Strong Passwords** with policy suggestions and password generation.

---

## 🌟 Key Features

* 📧 **Email Validator**:
  * RFC 5322 syntax validation.
  * Disposable / temporary burner inbox detection (`yopmail.com`, `mailinator.com`, etc.).
  * Typo suggestions for common domains (`gmai.com` ➔ `gmail.com`).
  * Alphanumeric start/end enforcement and consecutive dot prevention.
  * Provider-specific rules (e.g. Gmail 6–30 chars, no illegal symbols).
* 📱 **Phone Validator**:
  * 240+ countries international phone parsing and formatting via `libphonenumber-js/max`.
  * E.164, International, National, and RFC 3966 formats.
  * Line type detection (`MOBILE`, `FIXED_LINE`, etc.).
  * Predictable dummy sequence (`12345678`) and repeated digits (`9999999999`) detection (`disallowDummy`).
  * Mobile-only enforcement (`mobileOnly`).
* 🔐 **Password Validator**:
  * Configurable password policy (length, uppercase, lowercase, numbers, special characters).
  * Common password dictionary protection (`password123`, `admin`, etc.).
  * Predictable keyboard sequence detection (`qwerty`, `123456`).
  * Strength score calculation (0–4: `very_weak`, `weak`, `fair`, `good`, `strong`) with actionable suggestions.
  * Cryptographically secure password generator (`PasswordValidator.generate()`).
* 🚀 **Express Middleware**:
  * `validateRequest()` middleware for validating `body`, `query`, and `params`.
  * Automatically halts invalid requests with standard HTTP 400 Bad Request payloads.

---

## 📦 Installation

```bash
# npm
npm install @helpful-insight/validator

# pnpm
pnpm add @helpful-insight/validator

# yarn
yarn add @helpful-insight/validator
```

---

## 🚀 Quick Start

```typescript
import { EmailValidator, PhoneValidator, PasswordValidator } from '@helpful-insight/validator';

// 1. Email
const emailRes = EmailValidator.validate('alex@gmai.com');
console.log(emailRes.suggestion); // "Did you mean alex@gmail.com?"

// 2. Phone
const phoneRes = PhoneValidator.validate('+919876543210');
console.log(phoneRes.isValid); // true
console.log(phoneRes.formats.e164); // "+919876543210"

// 3. Password
const passRes = PasswordValidator.validate('weak');
console.log(passRes.isValid); // false
console.log(passRes.suggestions); // ["Make your password at least 8 characters long..."]
```

---

## 📖 API Documentation

### 1. `EmailValidator`

#### `EmailValidator.validate(email, options?)`

Validates an email address against syntax rules, disposable provider blacklists, and provider-specific policies.

```typescript
import { EmailValidator } from '@helpful-insight/validator';

const result = EmailValidator.validate('user@example.com', {
  allowDisposable: false,           // Default: false (blocks burner emails)
  checkTypo: true,                  // Default: true (suggests domain corrections)
  requireAlphanumericStartEnd: true,// Default: true (blocks !user or user.)
  validateProviderRules: true       // Default: true (enforces Gmail/Outlook/etc. rules)
});
```

**Return Type (`EmailValidationResult`):**
```typescript
interface EmailValidationResult {
  isValid: boolean;
  normalizedEmail?: string;
  domain?: string;
  isDisposable?: boolean;
  suggestion?: string;
  error?: string;
}
```

#### Examples:
```typescript
EmailValidator.validate('user@yopmail.com');
// => { isValid: false, isDisposable: true, error: 'Disposable email addresses are not allowed' }

EmailValidator.validate('!123456@gmail.com');
// => { isValid: false, error: 'Email username must start with a letter or number' }

EmailValidator.validate('user@gmai.com');
// => { isValid: true, suggestion: 'Did you mean user@gmail.com?' }
```

---

### 2. `PhoneValidator`

#### `PhoneValidator.validate(phoneNumber, optionsOrDefaultCountry?)`

Parses and validates any international phone number using Google's full telecom numbering plans.

```typescript
import { PhoneValidator } from '@helpful-insight/validator';

// With Country Code fallback
const result = PhoneValidator.validate('9876543210', 'IN');

// With Advanced Options
const result = PhoneValidator.validate('+447918492015', {
  defaultCountry: 'GB',
  mobileOnly: true,    // Rejects landlines
  disallowDummy: true  // Rejects sequences like 123456 and repeated digits
});
```

**Return Type (`PhoneValidationResult`):**
```typescript
interface PhoneValidationResult {
  isValid: boolean;
  country?: CountryCode;
  countryCallingCode?: string;
  nationalNumber?: string;
  numberType?: 'MOBILE' | 'FIXED_LINE' | 'FIXED_LINE_OR_MOBILE' | 'TOLL_FREE' | ...;
  formats?: {
    e164: string;          // e.g. "+919876543210"
    international: string; // e.g. "+91 98765 43210"
    national: string;      // e.g. "098765 43210"
    rfc3966: string;       // e.g. "tel:+919876543210"
  };
  error?: string;
}
```

#### Helper Methods:
```typescript
// Fast boolean check
PhoneValidator.isValid('+14155552671'); // true

// Format directly to E.164
PhoneValidator.formatE164('4155552671', 'US'); // "+14155552671"
```

---

### 3. `PasswordValidator`

#### `PasswordValidator.validate(password, customPolicy?)`

Tests password strength against security policies and common dictionary attacks.

```typescript
import { PasswordValidator } from '@helpful-insight/validator';

const result = PasswordValidator.validate('P@ssw0rd!2026', {
  minLength: 8,              // Default: 8
  maxLength: 128,            // Default: 128
  requireUppercase: true,    // Default: true
  requireLowercase: true,    // Default: true
  requireNumbers: true,      // Default: true
  requireSpecialChars: true, // Default: true
  disallowCommon: true,      // Default: true (checks 10,000+ common passwords)
  disallowSequences: true    // Default: true (checks '1234', 'qwerty', etc.)
});
```

**Return Type (`PasswordValidationResult`):**
```typescript
interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 (Very Weak), 1 (Weak), 2 (Fair), 3 (Good), 4 (Strong)
  scoreLabel: 'very_weak' | 'weak' | 'fair' | 'good' | 'strong';
  suggestions: string[];
  failedRules: string[];
}
```

#### `PasswordValidator.generate(length?, customPolicy?)`
Generates a cryptographically secure random password satisfying the policy:
```typescript
const strongPassword = PasswordValidator.generate(16);
// => "kX9#mQ2$vL8!zR5@"
```

---

### 4. Express Middleware (`validateRequest`)

Integrate declarative validation directly into Express routes:

```typescript
import express from 'express';
import { validateRequest } from '@helpful-insight/validator';

const app = express();
app.use(express.json());

app.post(
  '/api/auth/register',
  validateRequest({
    body: {
      email: {
        required: true,
        email: { allowDisposable: false, checkTypo: true }
      },
      phone: {
        required: true,
        phone: { defaultCountry: 'IN', disallowDummy: true, mobileOnly: true }
      },
      password: {
        required: true,
        password: { minLength: 8, requireSpecialChars: true }
      }
    }
  }),
  (req, res) => {
    // Only reaches here if all inputs are 100% valid
    res.json({ success: true, message: 'User registered successfully' });
  }
);
```

#### Automatic Error Response (HTTP 400):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "One or more fields failed validation",
    "details": {
      "body.email": ["Disposable email addresses are not allowed"],
      "body.phone": ["Phone number contains predictable dummy sequence (123456)"]
    }
  }
}
```

---

## 📄 License

MIT © [Rohit Jain](https://github.com/Rohit-Jain11)
