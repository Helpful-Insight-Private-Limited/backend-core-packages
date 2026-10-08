import {
  parsePhoneNumberFromString,
  CountryCode,
  NumberFormat,
  NumberType
} from 'libphonenumber-js/max';

export interface PhoneValidationOptions {
  defaultCountry?: CountryCode;
  mobileOnly?: boolean;
  disallowDummy?: boolean;
}

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
   * @param optionsOrDefaultCountry Optional ISO country code (e.g. 'GB', 'IN') or PhoneValidationOptions
   */
  static validate(
    phoneNumber: string,
    optionsOrDefaultCountry?: CountryCode | PhoneValidationOptions
  ): PhoneValidationResult {
    if (!phoneNumber || typeof phoneNumber !== 'string') {
      return { isValid: false, error: 'Phone number must be a non-empty string' };
    }

    const options: PhoneValidationOptions =
      typeof optionsOrDefaultCountry === 'string'
        ? { defaultCountry: optionsOrDefaultCountry }
        : optionsOrDefaultCountry || {};
    const defaultCountry = options.defaultCountry;

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

      const numberType = parsed.getType();

      if (options.mobileOnly && numberType && numberType !== 'MOBILE' && numberType !== 'FIXED_LINE_OR_MOBILE') {
        return {
          isValid: false,
          country: parsed.country,
          countryCallingCode: parsed.countryCallingCode,
          nationalNumber: parsed.nationalNumber,
          numberType,
          error: `Phone number is a ${numberType.toLowerCase().replace(/_/g, ' ')} number, but only mobile numbers are allowed`
        };
      }

      if (options.disallowDummy !== false && parsed.nationalNumber) {
        const nat = parsed.nationalNumber;
        // Repeated identical digits (e.g. 9999999999, 1111111111, or 5+ same digits in a row)
        if (/^(\d)\1+$/.test(nat) || /(\d)\1{4,}/.test(nat)) {
          return {
            isValid: false,
            country: parsed.country,
            countryCallingCode: parsed.countryCallingCode,
            nationalNumber: nat,
            numberType,
            error: 'Phone number contains repeated dummy digits'
          };
        }
        // Alternating digits (e.g. 1212121212, 0101010101)
        if (nat.length >= 6 && /^(\d{2})\1{2,}$/.test(nat)) {
          return {
            isValid: false,
            country: parsed.country,
            countryCallingCode: parsed.countryCallingCode,
            nationalNumber: nat,
            numberType,
            error: 'Phone number contains repetitive dummy sequence'
          };
        }
        // Predictable sequences (e.g. 12345678, 98765432)
        const sequences = ['0123456789', '9876543210'];
        for (const seq of sequences) {
          for (let i = 0; i <= seq.length - 6; i++) {
            const sub = seq.substring(i, i + 6);
            if (nat.includes(sub)) {
              return {
                isValid: false,
                country: parsed.country,
                countryCallingCode: parsed.countryCallingCode,
                nationalNumber: nat,
                numberType,
                error: `Phone number contains predictable dummy sequence (${sub})`
              };
            }
          }
        }
      }

      return {
        isValid: true,
        country: parsed.country,
        countryCallingCode: parsed.countryCallingCode,
        nationalNumber: parsed.nationalNumber,
        numberType,
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

  static isValid(
    phoneNumber: string,
    optionsOrDefaultCountry?: CountryCode | PhoneValidationOptions
  ): boolean {
    return this.validate(phoneNumber, optionsOrDefaultCountry).isValid;
  }

  static formatE164(
    phoneNumber: string,
    optionsOrDefaultCountry?: CountryCode | PhoneValidationOptions
  ): string | null {
    const res = this.validate(phoneNumber, optionsOrDefaultCountry);
    return res.isValid && res.formats ? res.formats.e164 : null;
  }
}
