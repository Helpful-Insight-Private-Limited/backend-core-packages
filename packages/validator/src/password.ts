import * as crypto from 'crypto';

export interface PasswordPolicy {
  minLength?: number;
  maxLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
  disallowCommon?: boolean;
  disallowSequences?: boolean;
}

export interface PasswordValidationResult {
  isValid: boolean;
  score: number; // 0 (Very Weak), 1 (Weak), 2 (Fair), 3 (Good), 4 (Strong)
  scoreLabel: 'very_weak' | 'weak' | 'fair' | 'good' | 'strong';
  suggestions: string[];
  failedRules: string[];
}

const COMMON_PASSWORDS = new Set([
  'password',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  '12345',
  '111111',
  '1234567',
  'dragon',
  'welcome',
  'admin',
  'admin123',
  'root',
  'password123',
  'iloveyou',
  'monkey',
  'sunshine',
  'master',
  'football',
  'charlie'
]);

const SEQUENCES = [
  '0123456789',
  '9876543210',
  'abcdefghijklmnopqrstuvwxyz',
  'qwertyuiop',
  'asdfghjkl',
  'zxcvbnm'
];

export class PasswordValidator {
  static readonly DEFAULT_POLICY: Required<PasswordPolicy> = {
    minLength: 8,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    disallowCommon: true,
    disallowSequences: true
  };

  static validate(password: string, customPolicy?: PasswordPolicy): PasswordValidationResult {
    const policy = { ...this.DEFAULT_POLICY, ...customPolicy };
    const suggestions: string[] = [];
    const failedRules: string[] = [];

    if (!password || typeof password !== 'string') {
      return {
        isValid: false,
        score: 0,
        scoreLabel: 'very_weak',
        suggestions: ['Password must be a non-empty string'],
        failedRules: ['non_empty']
      };
    }

    // 1. Length checks
    if (password.length < policy.minLength) {
      failedRules.push('min_length');
      suggestions.push(
        `Make your password at least ${policy.minLength} characters long (currently ${password.length}).`
      );
    }

    if (password.length > policy.maxLength) {
      failedRules.push('max_length');
      suggestions.push(`Password must not exceed ${policy.maxLength} characters.`);
    }

    // 2. Character classes
    const hasUpper = /[A-Z]/.test(password);
    if (policy.requireUppercase && !hasUpper) {
      failedRules.push('require_uppercase');
      suggestions.push('Include at least one uppercase letter (A-Z).');
    }

    const hasLower = /[a-z]/.test(password);
    if (policy.requireLowercase && !hasLower) {
      failedRules.push('require_lowercase');
      suggestions.push('Include at least one lowercase letter (a-z).');
    }

    const hasNumber = /[0-9]/.test(password);
    if (policy.requireNumbers && !hasNumber) {
      failedRules.push('require_numbers');
      suggestions.push('Include at least one number (0-9).');
    }

    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    if (policy.requireSpecialChars && !hasSpecial) {
      failedRules.push('require_special_chars');
      suggestions.push('Include at least one special character (e.g. !@#$%^&*).');
    }

    // 3. Common passwords
    if (policy.disallowCommon && COMMON_PASSWORDS.has(password.toLowerCase())) {
      failedRules.push('disallow_common');
      suggestions.push('This password is very common and easily guessed. Please choose a unique passphrase.');
    }

    // 4. Sequential patterns
    if (policy.disallowSequences) {
      const lower = password.toLowerCase();
      for (const seq of SEQUENCES) {
        for (let i = 0; i <= seq.length - 4; i++) {
          const sub = seq.substring(i, i + 4);
          if (lower.includes(sub)) {
            failedRules.push('disallow_sequences');
            suggestions.push(`Avoid predictable sequences like "${sub}".`);
            break;
          }
        }
      }
    }

    // Calculate score (0-4)
    let score = 0;
    if (password.length >= policy.minLength) score++;
    if (password.length >= 12) score++;
    const varietyCount = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    if (varietyCount >= 3) score++;
    if (varietyCount === 4 && password.length >= 14 && failedRules.length === 0) score++;
    if (failedRules.includes('disallow_common') || failedRules.includes('min_length')) {
      score = Math.min(score, 1);
    }
    score = Math.min(4, Math.max(0, score));

    const labels: Array<PasswordValidationResult['scoreLabel']> = [
      'very_weak',
      'weak',
      'fair',
      'good',
      'strong'
    ];

    return {
      isValid: failedRules.length === 0,
      score,
      scoreLabel: labels[score],
      suggestions,
      failedRules
    };
  }

  static isValid(password: string, customPolicy?: PasswordPolicy): boolean {
    return this.validate(password, customPolicy).isValid;
  }

  /**
   * Generates a cryptographically secure random password meeting all policy criteria.
   */
  static generate(length = 16, customPolicy?: PasswordPolicy): string {
    const policy = { ...this.DEFAULT_POLICY, ...customPolicy };
    const actualLength = Math.max(length, policy.minLength);

    const uppers = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowers = 'abcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%^&*()_+-=[]{}|;:,.<>?';

    let charPool = lowers;
    const requiredChars: string[] = [];

    if (policy.requireUppercase) {
      charPool += uppers;
      requiredChars.push(uppers[crypto.randomInt(0, uppers.length)]);
    }
    if (policy.requireLowercase) {
      requiredChars.push(lowers[crypto.randomInt(0, lowers.length)]);
    }
    if (policy.requireNumbers) {
      charPool += numbers;
      requiredChars.push(numbers[crypto.randomInt(0, numbers.length)]);
    }
    if (policy.requireSpecialChars) {
      charPool += specials;
      requiredChars.push(specials[crypto.randomInt(0, specials.length)]);
    }

    while (requiredChars.length < actualLength) {
      requiredChars.push(charPool[crypto.randomInt(0, charPool.length)]);
    }

    // Fisher-Yates shuffle
    for (let i = requiredChars.length - 1; i > 0; i--) {
      const j = crypto.randomInt(0, i + 1);
      [requiredChars[i], requiredChars[j]] = [requiredChars[j], requiredChars[i]];
    }

    return requiredChars.join('');
  }
}
