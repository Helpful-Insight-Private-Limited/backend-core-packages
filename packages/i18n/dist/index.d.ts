import { RequestHandler } from 'express';

type TranslationDictionary = Record<string, any>;
interface I18nOptions {
    defaultLocale?: string;
    fallbackLocale?: string;
    supportedLocales?: string[];
    translations?: Record<string, TranslationDictionary>;
    translationsDir?: string;
}
interface TranslateOptions {
    locale?: string;
    [key: string]: any;
}
declare class I18nService {
    private defaultLocale;
    private fallbackLocale;
    private supportedLocales;
    private dictionaries;
    constructor(options?: I18nOptions);
    registerDictionary(locale: string, dict: TranslationDictionary): void;
    loadFromDirectory(dirPath: string): void;
    getSupportedLocales(): string[];
    getDefaultLocale(): string;
    setDefaultLocale(locale: string): void;
    /**
     * Translate key with optional interpolation and count-based pluralization.
     * e.g. t('auth.welcome', { name: 'Alice' })
     * e.g. t('cart.items', { count: 5 })
     */
    t(key: string, options?: TranslateOptions): string;
    private lookup;
    private interpolate;
    private deepMerge;
    private isObject;
}

declare global {
    namespace Express {
        interface Request {
            locale: string;
            i18n: I18nService;
            t: (key: string, options?: Omit<TranslateOptions, 'locale'>) => string;
        }
    }
}
interface I18nMiddlewareOptions extends I18nOptions {
    service?: I18nService;
    queryParam?: string;
    headerName?: string;
}
declare function createI18nMiddleware(options?: I18nMiddlewareOptions): RequestHandler;

export { type I18nMiddlewareOptions, type I18nOptions, I18nService, type TranslateOptions, type TranslationDictionary, createI18nMiddleware };
