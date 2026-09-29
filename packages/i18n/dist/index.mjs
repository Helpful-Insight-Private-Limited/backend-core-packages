// src/i18n.ts
import * as fs from "fs";
import * as path from "path";
var I18nService = class {
  defaultLocale;
  fallbackLocale;
  supportedLocales;
  dictionaries = /* @__PURE__ */ new Map();
  constructor(options = {}) {
    this.defaultLocale = (options.defaultLocale || process.env.APP_LOCALE || "en").toLowerCase();
    this.fallbackLocale = (options.fallbackLocale || process.env.APP_FALLBACK_LOCALE || "en").toLowerCase();
    const initialSupported = options.supportedLocales || [
      this.defaultLocale,
      this.fallbackLocale
    ];
    this.supportedLocales = new Set(
      initialSupported.map((l) => l.toLowerCase())
    );
    if (options.translations) {
      for (const [locale, dict] of Object.entries(options.translations)) {
        this.registerDictionary(locale, dict);
      }
    }
    if (options.translationsDir) {
      this.loadFromDirectory(options.translationsDir);
    }
  }
  registerDictionary(locale, dict) {
    const loc = locale.toLowerCase();
    const existing = this.dictionaries.get(loc) || {};
    this.dictionaries.set(loc, this.deepMerge(existing, dict));
    this.supportedLocales.add(loc);
  }
  loadFromDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);
    for (const file of files) {
      if (file.endsWith(".json")) {
        const locale = path.basename(file, ".json").toLowerCase();
        try {
          const content = fs.readFileSync(path.join(dirPath, file), "utf-8");
          const parsed = JSON.parse(content);
          this.registerDictionary(locale, parsed);
        } catch (err) {
          console.error(`Failed to load translation file ${file}:`, err);
        }
      }
    }
  }
  getSupportedLocales() {
    return Array.from(this.supportedLocales);
  }
  getDefaultLocale() {
    return this.defaultLocale;
  }
  setDefaultLocale(locale) {
    this.defaultLocale = locale.toLowerCase();
    this.supportedLocales.add(this.defaultLocale);
  }
  /**
   * Translate key with optional interpolation and count-based pluralization.
   * e.g. t('auth.welcome', { name: 'Alice' })
   * e.g. t('cart.items', { count: 5 })
   */
  t(key, options = {}) {
    const locale = (options.locale || this.defaultLocale).toLowerCase();
    let translation = this.lookup(locale, key, options);
    if (translation === void 0 && locale !== this.defaultLocale) {
      translation = this.lookup(this.defaultLocale, key, options);
    }
    if (translation === void 0 && locale !== this.fallbackLocale && this.defaultLocale !== this.fallbackLocale) {
      translation = this.lookup(this.fallbackLocale, key, options);
    }
    if (translation === void 0) {
      return key;
    }
    return this.interpolate(translation, options);
  }
  lookup(locale, key, options) {
    const dict = this.dictionaries.get(locale);
    if (!dict) return void 0;
    const parts = key.split(".");
    let current = dict;
    for (const part of parts) {
      if (current === void 0 || current === null) return void 0;
      current = current[part];
    }
    if (typeof current === "object" && current !== null && typeof options.count === "number") {
      const count = options.count;
      if (count === 0 && current.zero) return current.zero;
      if (count === 1 && current.one) return current.one;
      if (current.other) return current.other;
    }
    return typeof current === "string" ? current : void 0;
  }
  interpolate(template, vars) {
    return template.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (match, p1, p2) => {
      const key = p1 || p2;
      return vars[key] !== void 0 ? String(vars[key]) : match;
    });
  }
  deepMerge(target, source) {
    const output = { ...target };
    if (this.isObject(target) && this.isObject(source)) {
      Object.keys(source).forEach((key) => {
        if (this.isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key];
          } else {
            output[key] = this.deepMerge(target[key], source[key]);
          }
        } else {
          output[key] = source[key];
        }
      });
    }
    return output;
  }
  isObject(item) {
    return item && typeof item === "object" && !Array.isArray(item);
  }
};

// src/express.ts
function createI18nMiddleware(options = {}) {
  const service = options.service || new I18nService(options);
  const queryParam = options.queryParam || "lang";
  const headerName = (options.headerName || "x-language").toLowerCase();
  return (req, res, next) => {
    let detectedLocale;
    if (req.query && typeof req.query[queryParam] === "string") {
      detectedLocale = req.query[queryParam];
    } else if (req.query && typeof req.query.locale === "string") {
      detectedLocale = req.query.locale;
    }
    if (!detectedLocale && req.headers[headerName] && typeof req.headers[headerName] === "string") {
      detectedLocale = req.headers[headerName];
    }
    if (!detectedLocale && req.headers["accept-language"]) {
      const acceptHeader = req.headers["accept-language"];
      const preferences = acceptHeader.split(",").map((part) => {
        const [lang, q] = part.trim().split(";q=");
        return { lang: lang.trim().toLowerCase(), q: q ? parseFloat(q) : 1 };
      }).sort((a, b) => b.q - a.q);
      const supported = service.getSupportedLocales();
      for (const pref of preferences) {
        if (supported.includes(pref.lang)) {
          detectedLocale = pref.lang;
          break;
        }
        const prefix = pref.lang.split("-")[0];
        if (supported.includes(prefix)) {
          detectedLocale = prefix;
          break;
        }
      }
    }
    if (!detectedLocale && req.user?.language) {
      detectedLocale = req.user.language;
    }
    const finalLocale = (detectedLocale || service.getDefaultLocale()).toLowerCase();
    req.locale = finalLocale;
    req.i18n = service;
    req.t = (key, opts = {}) => {
      return service.t(key, { ...opts, locale: finalLocale });
    };
    res.setHeader("Content-Language", finalLocale);
    next();
  };
}
export {
  I18nService,
  createI18nMiddleware
};
