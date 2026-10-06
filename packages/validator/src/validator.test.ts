import { describe, it, expect } from 'vitest';
import { EmailValidator } from './email.js';
import { PhoneValidator } from './phone.js';
import { PasswordValidator } from './password.js';

describe('@core/validator', () => {
  describe('EmailValidator', () => {
    it('should validate valid emails', () => {
      const res = EmailValidator.validate('john.doe@example.com');
      expect(res.isValid).toBe(true);
      expect(res.normalizedEmail).toBe('john.doe@example.com');
      expect(res.domain).toBe('example.com');
    });

    it('should reject invalid email formats', () => {
      expect(EmailValidator.isValid('not-an-email')).toBe(false);
      expect(EmailValidator.isValid('missing-domain@')).toBe(false);
      expect(EmailValidator.isValid('!123456@gmail.com')).toBe(false);
      expect(EmailValidator.isValid('.username@example.com')).toBe(false);
      expect(EmailValidator.isValid('user..name@example.com')).toBe(false);
    });

    it('should enforce provider-specific rules for Gmail', () => {
      const res = EmailValidator.validate('!123456@gmail.com');
      expect(res.isValid).toBe(false);
      expect(res.error).toBe('Email username must start with a letter or number');

      const symbolInGmail = EmailValidator.validate('user!name@gmail.com');
      expect(symbolInGmail.isValid).toBe(false);
      expect(symbolInGmail.error).toContain('Gmail usernames can only contain letters, numbers, and periods');
    });

    it('should reject disposable emails by default', () => {
      const res = EmailValidator.validate('spammer@mailinator.com');
      expect(res.isValid).toBe(false);
      expect(res.isDisposable).toBe(true);
    });

    it('should suggest corrections for common domain typos', () => {
      const res = EmailValidator.validate('alex@gmai.com');
      expect(res.suggestion).toBe('Did you mean alex@gmail.com?');
    });
  });

  describe('PhoneValidator', () => {
    it('should validate international numbers in E.164 format', () => {
      const res = PhoneValidator.validate('+14155552671');
      expect(res.isValid).toBe(true);
      expect(res.country).toBe('US');
      expect(res.formats?.e164).toBe('+14155552671');
    });

    it('should validate national numbers when defaultCountry is provided', () => {
      const res = PhoneValidator.validate('9876543210', 'IN');
      expect(res.isValid).toBe(true);
      expect(res.country).toBe('IN');
      expect(res.formats?.e164).toBe('+919876543210');
    });

    it('should fail on invalid numbers', () => {
      const res = PhoneValidator.validate('12345', 'US');
      expect(res.isValid).toBe(false);

      const fakeIndianNumber = PhoneValidator.validate('+911111111111');
      expect(fakeIndianNumber.isValid).toBe(false);
      expect(fakeIndianNumber.error).toContain('Phone number is invalid');
    });

    it('should detect and reject dummy numbers when disallowDummy is enabled', () => {
      // UK valid mobile format, but contains sequential 123456
      const seqCheck = PhoneValidator.validate('+447912345678', { disallowDummy: true });
      expect(seqCheck.isValid).toBe(false);
      expect(seqCheck.error).toContain('predictable dummy sequence');

      // Repeated identical digits
      const repeatCheck = PhoneValidator.validate('+919999999999', { disallowDummy: true });
      expect(repeatCheck.isValid).toBe(false);
      expect(repeatCheck.error).toContain('repeated dummy digits');

      // Valid random mobile passes
      const validCheck = PhoneValidator.validate('+447918492015', { disallowDummy: true });
      expect(validCheck.isValid).toBe(true);
    });

    it('should enforce mobileOnly when requested', () => {
      // US Google fixed-line or toll-free vs mobile
      const res = PhoneValidator.validate('+447918492015', { mobileOnly: true });
      expect(res.isValid).toBe(true);
      expect(res.numberType).toBe('MOBILE');
    });
  });

  describe('PasswordValidator', () => {
    it('should accept strong passwords', () => {
      const res = PasswordValidator.validate('SecretP@ssw0rd!2026');
      expect(res.isValid).toBe(true);
      expect(res.score).toBeGreaterThanOrEqual(3);
      expect(res.suggestions.length).toBe(0);
    });

    it('should give actionable suggestions on weak passwords', () => {
      const res = PasswordValidator.validate('weak');
      expect(res.isValid).toBe(false);
      expect(res.suggestions.length).toBeGreaterThan(0);
      expect(res.suggestions.some((s) => s.includes('characters long'))).toBe(true);
    });

    it('should detect common passwords', () => {
      const res = PasswordValidator.validate('password123');
      expect(res.failedRules).toContain('disallow_common');
    });

    it('should generate valid strong passwords', () => {
      const pwd = PasswordValidator.generate(18);
      const res = PasswordValidator.validate(pwd);
      expect(pwd.length).toBe(18);
      expect(res.isValid).toBe(true);
    });
  });
});
