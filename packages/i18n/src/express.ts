import { Request, Response, NextFunction, RequestHandler } from 'express';
import { I18nService, I18nOptions, TranslateOptions } from './i18n.js';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      locale: string;
      i18n: I18nService;
      t: (key: string, options?: Omit<TranslateOptions, 'locale'>) => string;
    }
  }
}

export interface I18nMiddlewareOptions extends I18nOptions {
  service?: I18nService;
  queryParam?: string;
  headerName?: string;
}

export function createI18nMiddleware(options: I18nMiddlewareOptions = {}): RequestHandler {
  const service = options.service || new I18nService(options);
  const queryParam = options.queryParam || 'lang';
  const headerName = (options.headerName || 'x-language').toLowerCase();

  return (req: Request, res: Response, next: NextFunction): void => {
    let detectedLocale: string | undefined;

    // 1. Check query parameter (?lang=es or ?locale=es)
    if (req.query && typeof req.query[queryParam] === 'string') {
      detectedLocale = req.query[queryParam] as string;
    } else if (req.query && typeof req.query.locale === 'string') {
      detectedLocale = req.query.locale as string;
    }

    // 2. Check custom header (x-language)
    if (!detectedLocale && req.headers[headerName] && typeof req.headers[headerName] === 'string') {
      detectedLocale = req.headers[headerName] as string;
    }

    // 3. Check Accept-Language header
    if (!detectedLocale && req.headers['accept-language']) {
      const acceptHeader = req.headers['accept-language'] as string;
      // Parse "fr-CH, fr;q=0.9, en;q=0.8" -> ["fr-ch", "fr", "en"]
      const preferences = acceptHeader
        .split(',')
        .map((part) => {
          const [lang, q] = part.trim().split(';q=');
          return { lang: lang.trim().toLowerCase(), q: q ? parseFloat(q) : 1.0 };
        })
        .sort((a, b) => b.q - a.q);

      const supported = service.getSupportedLocales();
      for (const pref of preferences) {
        // Direct match (e.g. 'fr')
        if (supported.includes(pref.lang)) {
          detectedLocale = pref.lang;
          break;
        }
        // Prefix match (e.g. 'fr-FR' -> 'fr')
        const prefix = pref.lang.split('-')[0];
        if (supported.includes(prefix)) {
          detectedLocale = prefix;
          break;
        }
      }
    }

    // 4. Check user profile if attached (e.g. req.user.language)
    if (!detectedLocale && (req as any).user?.language) {
      detectedLocale = (req as any).user.language;
    }

    // 5. Fallback to default locale (process.env.APP_LOCALE or 'en')
    const finalLocale = (detectedLocale || service.getDefaultLocale()).toLowerCase();

    // Attach to request
    req.locale = finalLocale;
    req.i18n = service;
    req.t = (key: string, opts: Omit<TranslateOptions, 'locale'> = {}) => {
      return service.t(key, { ...opts, locale: finalLocale });
    };

    // Attach Content-Language response header
    res.setHeader('Content-Language', finalLocale);

    next();
  };
}
