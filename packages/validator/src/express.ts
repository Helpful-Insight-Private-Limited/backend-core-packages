import { Request, Response, NextFunction, RequestHandler } from 'express';
import { EmailValidator, EmailValidationOptions } from './email.js';
import { PhoneValidator } from './phone.js';
import { PasswordValidator, PasswordPolicy } from './password.js';
import { CountryCode } from 'libphonenumber-js';

export interface FieldValidationRules {
  email?: boolean | EmailValidationOptions;
  phone?: boolean | { defaultCountry?: CountryCode };
  password?: boolean | PasswordPolicy;
  required?: boolean;
}

export type SchemaRules = Record<string, FieldValidationRules>;

export interface RequestValidationSchema {
  body?: SchemaRules;
  query?: SchemaRules;
  params?: SchemaRules;
}

export function validateRequest(schema: RequestValidationSchema): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: Record<string, string[]> = {};

    const validateSection = (
      data: any,
      rules: SchemaRules | undefined,
      sectionName: string
    ) => {
      if (!rules) return;
      const target = data || {};

      for (const [field, rule] of Object.entries(rules)) {
        const val = target[field];
        const fieldKey = `${sectionName}.${field}`;

        if (rule.required && (val === undefined || val === null || val === '')) {
          errors[fieldKey] = errors[fieldKey] || [];
          errors[fieldKey].push(`Field '${field}' is required`);
          continue;
        }

        if (val === undefined || val === null || val === '') {
          continue; // optional and missing, pass
        }

        // Email validation
        if (rule.email) {
          const opts = typeof rule.email === 'object' ? rule.email : undefined;
          const result = EmailValidator.validate(String(val), opts);
          if (!result.isValid) {
            errors[fieldKey] = errors[fieldKey] || [];
            errors[fieldKey].push(result.error || 'Invalid email address');
            if (result.suggestion) {
              errors[fieldKey].push(result.suggestion);
            }
          }
        }

        // Phone validation
        if (rule.phone) {
          const defaultCountry =
            typeof rule.phone === 'object' ? rule.phone.defaultCountry : undefined;
          const result = PhoneValidator.validate(String(val), defaultCountry);
          if (!result.isValid) {
            errors[fieldKey] = errors[fieldKey] || [];
            errors[fieldKey].push(result.error || 'Invalid phone number');
          }
        }

        // Password validation
        if (rule.password) {
          const policy =
            typeof rule.password === 'object' ? rule.password : undefined;
          const result = PasswordValidator.validate(String(val), policy);
          if (!result.isValid) {
            errors[fieldKey] = errors[fieldKey] || [];
            errors[fieldKey].push(...result.suggestions);
          }
        }
      }
    };

    validateSection(req.body, schema.body, 'body');
    validateSection(req.query, schema.query, 'query');
    validateSection(req.params, schema.params, 'params');

    if (Object.keys(errors).length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'One or more fields failed validation',
          details: errors
        }
      });
      return;
    }

    next();
  };
}
