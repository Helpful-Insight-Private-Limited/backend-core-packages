export interface EmailValidationOptions {
  allowDisposable?: boolean;
  checkTypo?: boolean;
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
