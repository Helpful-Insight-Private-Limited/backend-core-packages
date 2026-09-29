import * as fs from 'fs';
import * as path from 'path';

export type TranslationDictionary = Record<string, any>;

export interface I18nOptions {
  defaultLocale?: string;
  fallbackLocale?: string;
  supportedLocales?: string[];
  translations?: Record<string, TranslationDictionary>;
  translationsDir?: string;
}

export interface TranslateOptions {
  locale?: string;
  [key: string]: any;
}

export class I18nService {
  private defaultLocale: string;
  private fallbackLocale: string;
  private supportedLocales: Set<string>;
  private dictionaries: Map<string, TranslationDictionary> = new Map();

  constructor(options: I18nOptions = {}) {
    // Read from environment variables if not passed explicitly
    this.defaultLocale = (
      options.defaultLocale ||
      process.env.APP_LOCALE ||
      'en'
    ).toLowerCase();

    this.fallbackLocale = (
      options.fallbackLocale ||
      process.env.APP_FALLBACK_LOCALE ||
      'en'
    ).toLowerCase();

    const initialSupported = options.supportedLocales || [
      this.defaultLocale,
      this.fallbackLocale
    ];
    this.supportedLocales = new Set(
      initialSupported.map((l) => l.toLowerCase())
    );

    // Load in-memory dictionaries if provided
    if (options.translations) {
      for (const [locale, dict] of Object.entries(options.translations)) {
        this.registerDictionary(locale, dict);
      }
    }

    // Load from disk if directory provided
    if (options.translationsDir) {
      this.loadFromDirectory(options.translationsDir);
    }
  }

  public registerDictionary(locale: string, dict: TranslationDictionary): void {
    const loc = locale.toLowerCase();
    const existing = this.dictionaries.get(loc) || {};
    this.dictionaries.set(loc, this.deepMerge(existing, dict));
    this.supportedLocales.add(loc);
  }

  public loadFromDirectory(dirPath: string): void {
    if (!fs.existsSync(dirPath)) return;
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      if (file.endsWith('.json')) {
        const locale = path.basename(file, '.json').toLowerCase();
        try {
          const content = fs.readFileSync(path.join(dirPath, file), 'utf-8');
          const parsed = JSON.parse(content);
          this.registerDictionary(locale, parsed);
        } catch (err) {
          console.error(`Failed to load translation file ${file}:`, err);
        }
      }
    }
  }

  public getSupportedLocales(): string[] {
    return Array.from(this.supportedLocales);
  }

  public getDefaultLocale(): string {
    return this.defaultLocale;
  }

  public setDefaultLocale(locale: string): void {
    this.defaultLocale = locale.toLowerCase();
    this.supportedLocales.add(this.defaultLocale);
  }

  /**
   * Translate key with optional interpolation and count-based pluralization.
   * e.g. t('auth.welcome', { name: 'Alice' })
   * e.g. t('cart.items', { count: 5 })
   */
  public t(key: string, options: TranslateOptions = {}): string {
    const locale = (options.locale || this.defaultLocale).toLowerCase();

    // 1. Try target locale
    let translation = this.lookup(locale, key, options);

    // 2. Try default locale if different
    if (translation === undefined && locale !== this.defaultLocale) {
      translation = this.lookup(this.defaultLocale, key, options);
    }

    // 3. Try fallback locale
    if (translation === undefined && locale !== this.fallbackLocale && this.defaultLocale !== this.fallbackLocale) {
      translation = this.lookup(this.fallbackLocale, key, options);
    }

    // 4. If still not found, return key
    if (translation === undefined) {
      return key;
    }

    // Interpolate variables
    return this.interpolate(translation, options);
  }

  private lookup(locale: string, key: string, options: TranslateOptions): string | undefined {
    const dict = this.dictionaries.get(locale);
    if (!dict) return undefined;

    const parts = key.split('.');
    let current: any = dict;

    for (const part of parts) {
      if (current === undefined || current === null) return undefined;
      current = current[part];
    }

    // Check if current is a plural object (e.g. { zero: "...", one: "...", other: "..." })
    if (typeof current === 'object' && current !== null && typeof options.count === 'number') {
      const count = options.count;
      if (count === 0 && current.zero) return current.zero;
      if (count === 1 && current.one) return current.one;
      if (current.other) return current.other;
    }

    return typeof current === 'string' ? current : undefined;
  }

  private interpolate(template: string, vars: Record<string, any>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}|\{\s*(\w+)\s*\}/g, (match, p1, p2) => {
      const key = p1 || p2;
      return vars[key] !== undefined ? String(vars[key]) : match;
    });
  }

  private deepMerge(target: any, source: any): any {
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

  private isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item);
  }
}
