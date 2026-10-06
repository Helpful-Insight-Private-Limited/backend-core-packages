# @rohit-jain11/i18n

[![npm version](https://img.shields.io/npm/v/@rohit-jain11/i18n.svg)](https://www.npmjs.com/package/@rohit-jain11/i18n)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

Environment-driven Internationalization (i18n) and localization service for **Node.js, Express, and TypeScript**. Features multi-tier locale detection (Query, Custom Headers, `Accept-Language` RFC parsing, and User profile), fallback locales, variable interpolation, pluralization rules, and full TypeScript typings.

---

## 🌟 Key Features

* 🌍 **Environment-Controlled Default**:
  * Seamlessly driven by `process.env.APP_LOCALE` or configurable defaults.
* 🔍 **Multi-Tier Automated Locale Detection**:
  1. URL Query parameter (`?lang=es` or `?locale=es`).
  2. Custom request header (`x-language`).
  3. Standard browser `Accept-Language` header (with q-factor priority sorting and prefix matching `es-MX` ➔ `es`).
  4. Authenticated user profile (`req.user.language`).
  5. Fallback locale.
* 💬 **Smart Interpolation & Pluralization**:
  * Safe variable substitution: `{{name}}`, `{{count}}`.
  * Multi-form pluralization: `zero`, `one`, and `other`.
* 🛡️ **Graceful Fallbacks**:
  * If a translation key is missing in the target locale, falls back to the default locale.
  * If missing everywhere, safely returns the key string instead of crashing.
* 🚀 **Express Middleware**:
  * Automatically injects `req.t()`, `req.locale`, and `req.i18n`.
  * Sets the `Content-Language` HTTP response header.

---

## 📦 Installation

```bash
# npm
npm install @rohit-jain11/i18n

# pnpm
pnpm add @rohit-jain11/i18n

# yarn
yarn add @rohit-jain11/i18n
```

---

## 🚀 Quick Start

```typescript
import { I18nService } from '@rohit-jain11/i18n';

const i18n = new I18nService({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  translations: {
    en: {
      auth: {
        welcome: 'Welcome back, {{name}}!',
        error: 'Invalid email or password'
      },
      cart: {
        items: {
          zero: 'Your cart is empty',
          one: '1 item in your cart',
          other: '{{count}} items in your cart'
        }
      }
    },
    es: {
      auth: {
        welcome: '¡Bienvenido de nuevo, {{name}}!',
        error: 'Correo electrónico o contraseña no válidos'
      }
    }
  }
});

// Translate in default locale
console.log(i18n.t('auth.welcome', { name: 'Alice' }));
// => "Welcome back, Alice!"

// Translate in specified locale
console.log(i18n.t('auth.welcome', { locale: 'es', name: 'Carlos' }));
// => "¡Bienvenido de nuevo, Carlos!"

// Pluralization
console.log(i18n.t('cart.items', { count: 0 })); // "Your cart is empty"
console.log(i18n.t('cart.items', { count: 1 })); // "1 item in your cart"
console.log(i18n.t('cart.items', { count: 5 })); // "5 items in your cart"
```

---

## 🌐 Express Middleware Integration

Use `createI18nMiddleware` to enable automatic multi-language detection on all incoming HTTP requests:

```typescript
import express from 'express';
import { createI18nMiddleware, I18nService } from '@rohit-jain11/i18n';

const app = express();

const i18nService = new I18nService({
  defaultLocale: process.env.APP_LOCALE || 'en',
  translations: {
    en: { greeting: 'Hello {{name}}' },
    fr: { greeting: 'Bonjour {{name}}' },
    es: { greeting: 'Hola {{name}}' }
  }
});

app.use(createI18nMiddleware({
  service: i18nService,
  queryParam: 'lang',       // Detects ?lang=fr
  headerName: 'x-language'  // Detects x-language: fr
}));

app.get('/api/greeting', (req, res) => {
  // req.locale is automatically detected (e.g. 'fr')
  // req.t() automatically uses the detected locale
  res.json({
    locale: req.locale,
    message: req.t('greeting', { name: 'Alex' })
  });
});
```

---

## 📄 License

MIT © [Rohit Jain](https://github.com/Rohit-Jain11)
