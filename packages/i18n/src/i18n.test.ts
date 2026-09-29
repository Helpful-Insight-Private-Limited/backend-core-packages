import { describe, it, expect, beforeEach } from 'vitest';
import { I18nService } from './i18n.js';

describe('@core/i18n', () => {
  const translations = {
    en: {
      auth: {
        welcome: 'Welcome, {{name}}!',
        loginFailed: 'Invalid credentials'
      },
      items: {
        count: {
          zero: 'No items',
          one: '1 item',
          other: '{{count}} items'
        }
      }
    },
    es: {
      auth: {
        welcome: '¡Bienvenido, {{name}}!',
        loginFailed: 'Credenciales inválidas'
      }
    }
  };

  let service: I18nService;

  beforeEach(() => {
    service = new I18nService({
      defaultLocale: 'en',
      fallbackLocale: 'en',
      translations
    });
  });

  it('should translate in default locale', () => {
    const text = service.t('auth.welcome', { name: 'Alice' });
    expect(text).toBe('Welcome, Alice!');
  });

  it('should translate in specified locale', () => {
    const text = service.t('auth.welcome', { locale: 'es', name: 'Carlos' });
    expect(text).toBe('¡Bienvenido, Carlos!');
  });

  it('should fallback to default locale if key is missing in target locale', () => {
    const text = service.t('items.count', { locale: 'es', count: 5 });
    expect(text).toBe('5 items');
  });

  it('should handle pluralization correctly', () => {
    expect(service.t('items.count', { count: 0 })).toBe('No items');
    expect(service.t('items.count', { count: 1 })).toBe('1 item');
    expect(service.t('items.count', { count: 42 })).toBe('42 items');
  });

  it('should return key if not found in any locale', () => {
    expect(service.t('missing.key')).toBe('missing.key');
  });
});
