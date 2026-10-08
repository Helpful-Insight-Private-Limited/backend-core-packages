export interface EmailValidationOptions {
  allowDisposable?: boolean;
  checkTypo?: boolean;
  requireAlphanumericStartEnd?: boolean;
  validateProviderRules?: boolean;
  disallowDummy?: boolean;
  disallowConsecutiveSpecialChars?: boolean;
}

export interface EmailValidationResult {
  isValid: boolean;
  normalizedEmail?: string;
  domain?: string;
  isDisposable?: boolean;
  suggestion?: string;
  error?: string;
}

const RFC5322_REGEX =
  /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/;

const COMMON_DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'throwawaymail.com',
  'getairmail.com',
  'yopmail.com',
  'trashmail.com',
  'dispostable.com',
  'temp-mail.org',
  'fakeinbox.com'
]);

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  'gmai.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outloo.com': 'outlook.com',
  'outlok.com': 'outlook.com',
  'iclud.com': 'icloud.com',
  'protonmai.com': 'protonmail.com'
};

export class EmailValidator {
  static validate(
    email: string,
    options: EmailValidationOptions = { allowDisposable: false, checkTypo: true }
  ): EmailValidationResult {
    if (!email || typeof email !== 'string') {
      return { isValid: false, error: 'Email must be a non-empty string' };
    }

    const trimmed = email.trim();
    if (trimmed.length > 254) {
      return { isValid: false, error: 'Email exceeds maximum length of 254 characters' };
    }

    if (/\s/.test(trimmed)) {
      return { isValid: false, error: 'Email address cannot contain whitespace' };
    }

    if (!RFC5322_REGEX.test(trimmed)) {
      return { isValid: false, error: 'Invalid email address format' };
    }

    const parts = trimmed.split('@');
    if (parts.length !== 2) {
      return { isValid: false, error: 'Email must contain exactly one @ symbol' };
    }

    const [localPart, domainPart] = parts;
    const lowerDomain = domainPart.toLowerCase();
    const normalizedEmail = `${localPart}@${lowerDomain}`;

    const requireAlphanumericStartEnd = options.requireAlphanumericStartEnd !== false;
    const validateProviderRules = options.validateProviderRules !== false;
    const disallowDummy = options.disallowDummy !== false;
    const disallowConsecutiveSpecialChars = options.disallowConsecutiveSpecialChars !== false;

    // Consecutive special characters check (e.g. .., --, __, ++, or mixed combinations like .-)
    if (disallowConsecutiveSpecialChars) {
      if (/[._+\-]{2,}/.test(localPart)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username cannot contain consecutive special characters'
        };
      }
    }

    // Modern web validation: Local-part should start and end with alphanumeric characters
    if (requireAlphanumericStartEnd) {
      if (!/^[a-zA-Z0-9]/.test(localPart)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username must start with a letter or number'
        };
      }
      const basePart = localPart.includes('+') ? localPart.split('+')[0] : localPart;
      if (!/[a-zA-Z0-9]$/.test(basePart)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username must end with a letter or number'
        };
      }
      if (localPart.includes('..')) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username cannot contain consecutive dots'
        };
      }
    }

    // Plus-addressing validation
    if (localPart.includes('+')) {
      const plusParts = localPart.split('+');
      if (plusParts.length > 2) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username cannot contain multiple plus (+) symbols'
        };
      }
      const tag = plusParts[1];
      if (!tag || tag.length === 0) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email subaddress tag after plus (+) cannot be empty'
        };
      }
      if (!/^[a-zA-Z0-9._-]+$/.test(tag) || !/^[a-zA-Z0-9]/.test(tag) || !/[a-zA-Z0-9]$/.test(tag)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email subaddress tag must start and end with an alphanumeric character'
        };
      }
    }

    // Dummy / Spam username pattern detection
    if (disallowDummy) {
      const basePart = localPart.includes('+') ? localPart.split('+')[0] : localPart;

      // 1. All identical characters of length >= 4 (e.g. 000000000000, 111111, aaaaaa)
      if (/^(.)\1{3,}$/.test(basePart)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username contains repeated dummy characters'
        };
      }

      // 2. 5 or more identical characters in a row (e.g. ppppppppppppppppppppppppppp)
      if (/(.)\1{4,}/.test(basePart)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username contains repeated dummy characters'
        };
      }

      // 3. Alternating 2-character repetitive pattern (e.g. 010101010101, ababababab)
      if (basePart.length >= 6 && /^(.{2})\1{2,}$/.test(basePart)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username contains repetitive dummy pattern'
        };
      }

      // 4. Alternating 3-character repetitive pattern (e.g. 123123123)
      if (basePart.length >= 9 && /^(.{3})\1{2,}$/.test(basePart)) {
        return {
          isValid: false,
          normalizedEmail,
          domain: lowerDomain,
          error: 'Email username contains repetitive dummy pattern'
        };
      }
    }

    // Provider-specific rules (e.g. Gmail only allows letters, numbers, and periods)
    if (validateProviderRules) {
      if (lowerDomain === 'gmail.com' || lowerDomain === 'googlemail.com') {
        const basePart = localPart.includes('+') ? localPart.split('+')[0] : localPart;
        if (/[^a-zA-Z0-9.]/.test(basePart)) {
          return {
            isValid: false,
            normalizedEmail,
            domain: lowerDomain,
            error: 'Gmail usernames can only contain letters, numbers, and periods'
          };
        }
        if (basePart.length < 6 || basePart.length > 30) {
          return {
            isValid: false,
            normalizedEmail,
            domain: lowerDomain,
            error: 'Gmail username must be between 6 and 30 characters'
          };
        }
      }
    }

    const isDisposable = COMMON_DISPOSABLE_DOMAINS.has(lowerDomain);
    if (!options.allowDisposable && isDisposable) {
      return {
        isValid: false,
        normalizedEmail,
        domain: lowerDomain,
        isDisposable: true,
        error: 'Disposable email addresses are not allowed'
      };
    }

    let suggestion: string | undefined;
    if (options.checkTypo && COMMON_DOMAIN_TYPOS[lowerDomain]) {
      const suggestedDomain = COMMON_DOMAIN_TYPOS[lowerDomain];
      suggestion = `Did you mean ${localPart}@${suggestedDomain}?`;
    }

    return {
      isValid: true,
      normalizedEmail,
      domain: lowerDomain,
      isDisposable,
      suggestion
    };
  }

  static isValid(email: string, options?: EmailValidationOptions): boolean {
    return this.validate(email, options).isValid;
  }
}
