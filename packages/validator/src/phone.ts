import {
  parsePhoneNumberFromString,
  CountryCode,
  NumberFormat,
  NumberType
} from 'libphonenumber-js';

export interface PhoneValidationResult {
  isValid: boolean;
  country?: CountryCode;
  countryCallingCode?: string;
  nationalNumber?: string;
  numberType?: NumberType;
  formats?: {
    e164: string;
    international: string;
    national: string;
    rfc3966: string;
  };
  error?: string;
}

export class PhoneValidator {
  /**
   * Validate any international phone number across all countries.
   * @param phoneNumber The raw phone number string (e.g. '+14155552671' or '4155552671')
   * @param defaultCountry Optional ISO 3166-1 alpha-2 country code (e.g. 'US', 'GB', 'IN', 'CA')
   */
  static validate(
    phoneNumber: string,
    defaultCountry?: CountryCode
  ): PhoneValidationResult {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return { isValid: false, error: 'Phone number must be a non-empty string' };
    }

    try {
      const parsed = parsePhoneNumberFromString(phoneNumber, defaultCountry);

      if (!parsed) {
        return {
          isValid: false,
          error: 'Could not parse phone number. Ensure it includes a country code (e.g. +1...) or provide a default country.'
        };
      }

      const isValid = parsed.isValid();
      if (!isValid) {
        return {
          isValid: false,
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          error: `Phone number is invalid for country ${parsed.country || 'unknown'}`
        };
      }

      return {
        isValid: true,
        country: parsed.country,
        countryCallingCode: parsed.countryCallingCode,
        nationalNumber: parsed.nationalNumber,
        numberType: parsed.getType(),
        formats: {
          e164: parsed.format('E.164'),
          international: parsed.format('INTERNATIONAL'),
          national: parsed.format('NATIONAL'),
          rfc3966: parsed.format('RFC3966')
        }
      };
    } catch (err: any) {
      return {
        isValid: false,
        error: err.message || 'Failed to validate phone number'
      };
    }
  }

  static isValid(phoneNumber: string, defaultCountry?: CountryCode): boolean {
    return this.validate(phoneNumber, defaultCountry).isValid;
  }

  static formatE164(phoneNumber: string, defaultCountry?: CountryCode): string | null {
    const res = this.validate(phoneNumber, defaultCountry);
    return res.isValid && res.formats ? res.formats.e164 : null;
  }
}
