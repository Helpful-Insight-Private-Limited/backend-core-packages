import { CountryCode, NumberType } from 'libphonenumber-js/max';
import { RequestHandler } from 'express';

interface EmailValidationOptions {
    allowDisposable?: boolean;
    checkTypo?: boolean;
    requireAlphanumericStartEnd?: boolean;
    validateProviderRules?: boolean;
}
interface EmailValidationResult {
    isValid: boolean;
    normalizedEmail?: string;
    domain?: string;
    isDisposable?: boolean;
    suggestion?: string;
    error?: string;
}
declare class EmailValidator {
    static validate(email: string, options?: EmailValidationOptions): EmailValidationResult;
    static isValid(email: string, options?: EmailValidationOptions): boolean;
}

interface PhoneValidationOptions {
    defaultCountry?: CountryCode;
    mobileOnly?: boolean;
    disallowDummy?: boolean;
}
interface PhoneValidationResult {
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
declare class PhoneValidator {
    /**
     * Validate any international phone number across all countries.
     * @param phoneNumber The raw phone number string (e.g. '+14155552671' or '4155552671')
     * @param optionsOrDefaultCountry Optional ISO country code (e.g. 'GB', 'IN') or PhoneValidationOptions
     */
    static validate(phoneNumber: string, optionsOrDefaultCountry?: CountryCode | PhoneValidationOptions): PhoneValidationResult;
    static isValid(phoneNumber: string, optionsOrDefaultCountry?: CountryCode | PhoneValidationOptions): boolean;
    static formatE164(phoneNumber: string, optionsOrDefaultCountry?: CountryCode | PhoneValidationOptions): string | null;
}

interface PasswordPolicy {
    minLength?: number;
    maxLength?: number;
    requireUppercase?: boolean;
    requireLowercase?: boolean;
    requireNumbers?: boolean;
    requireSpecialChars?: boolean;
    disallowCommon?: boolean;
    disallowSequences?: boolean;
}
interface PasswordValidationResult {
    isValid: boolean;
    score: number;
    scoreLabel: 'very_weak' | 'weak' | 'fair' | 'good' | 'strong';
    suggestions: string[];
    failedRules: string[];
}
declare class PasswordValidator {
    static readonly DEFAULT_POLICY: Required<PasswordPolicy>;
    static validate(password: string, customPolicy?: PasswordPolicy): PasswordValidationResult;
    static isValid(password: string, customPolicy?: PasswordPolicy): boolean;
    /**
     * Generates a cryptographically secure random password meeting all policy criteria.
     */
    static generate(length?: number, customPolicy?: PasswordPolicy): string;
}

interface FieldValidationRules {
    email?: boolean | EmailValidationOptions;
    phone?: boolean | PhoneValidationOptions;
    password?: boolean | PasswordPolicy;
    required?: boolean;
}
type SchemaRules = Record<string, FieldValidationRules>;
interface RequestValidationSchema {
    body?: SchemaRules;
    query?: SchemaRules;
    params?: SchemaRules;
}
declare function validateRequest(schema: RequestValidationSchema): RequestHandler;

export { type EmailValidationOptions, type EmailValidationResult, EmailValidator, type FieldValidationRules, type PasswordPolicy, type PasswordValidationResult, PasswordValidator, type PhoneValidationOptions, type PhoneValidationResult, PhoneValidator, type RequestValidationSchema, type SchemaRules, validateRequest };
