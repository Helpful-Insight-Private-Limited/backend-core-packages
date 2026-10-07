import * as crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export class TotpService {
  /**
   * Generate a random base32 encoded secret for Google Authenticator.
   */
  static generateSecret(byteLength = 20): string {
    const randomBytes = crypto.randomBytes(byteLength);
    let secret = '';
    let buffer = 0;
    let bitsLeft = 0;

    for (let i = 0; i < randomBytes.length; i++) {
      buffer = (buffer << 8) | randomBytes[i];
      bitsLeft += 8;
      while (bitsLeft >= 5) {
        secret += BASE32_ALPHABET[(buffer >> (bitsLeft - 5)) & 31];
        bitsLeft -= 5;
      }
    }
    if (bitsLeft > 0) {
      secret += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31];
    }
    return secret;
  }

  /**
   * Decode base32 secret to Buffer.
   */
  private static base32Decode(secret: string): Buffer {
    const cleaned = secret.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
    let buffer = 0;
    let bitsLeft = 0;
    const output: number[] = [];

    for (let i = 0; i < cleaned.length; i++) {
      const val = BASE32_ALPHABET.indexOf(cleaned[i]);
      if (val === -1) continue;

      buffer = (buffer << 5) | val;
      bitsLeft += 5;

      if (bitsLeft >= 8) {
        output.push((buffer >> (bitsLeft - 8)) & 255);
        bitsLeft -= 8;
      }
    }

    return Buffer.from(output);
  }

  /**
   * Generate 6-digit TOTP token for given time (RFC 6238).
   */
  static generateToken(secret: string, timestampMs = Date.now(), timeStepSec = 30): string {
    const key = this.base32Decode(secret);
    const counter = Math.floor(timestampMs / 1000 / timeStepSec);

    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(counterBuffer);
    const digest = hmac.digest();

    const offset = digest[digest.length - 1] & 0xf;
    const code =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    const token = (code % 1000000).toString().padStart(6, '0');
    return token;
  }

  /**
   * Verify token with ±1 window tolerance (60s total window).
   */
  static verifyToken(
    token: string,
    secret: string,
    options: { window?: number; timestampMs?: number; timeStepSec?: number } = {}
  ): boolean {
    if (!token || token.length !== 6) return false;
    const window = options.window ?? 1;
    const timeStepSec = options.timeStepSec ?? 30;
    const currentMs = options.timestampMs ?? Date.now();

    for (let offset = -window; offset <= window; offset++) {
      const checkMs = currentMs + offset * timeStepSec * 1000;
      const expected = this.generateToken(secret, checkMs, timeStepSec);
      if (crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Build the otpauth URI for QR codes.
   */
  static getOtpAuthUri(options: {
    issuer: string;
    accountName: string;
    secret: string;
  }): string {
    const label = encodeURIComponent(`${options.issuer}:${options.accountName}`);
    const issuerParam = encodeURIComponent(options.issuer);
    return `otpauth://totp/${label}?secret=${options.secret}&issuer=${issuerParam}&algorithm=SHA1&digits=6&period=30`;
  }

  /**
   * Generate emergency recovery backup codes (e.g. 10 codes).
   */
  static generateBackupCodes(count = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      // Format as XXXX-XXXX
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }
    return codes;
  }

  /**
   * Cryptographically hash a single backup code using SHA-256 before database storage.
   */
  static hashBackupCode(code: string): string {
    return crypto
      .createHash('sha256')
      .update(code.trim().toUpperCase().replace(/\s+/g, ''))
      .digest('hex');
  }

  /**
   * Verify an input code against a list of hashed backup codes in constant time.
   * Returns whether it matched and the updated list of remaining hashed codes (single-use).
   */
  static verifyBackupCode(
    inputCode: string,
    hashedCodes: string[]
  ): { isValid: boolean; remainingHashedCodes: string[] } {
    if (!inputCode || !hashedCodes || !Array.isArray(hashedCodes)) {
      return { isValid: false, remainingHashedCodes: hashedCodes || [] };
    }

    const hashedInput = this.hashBackupCode(inputCode);
    const inputBuf = Buffer.from(hashedInput);

    let matchIndex = -1;
    for (let i = 0; i < hashedCodes.length; i++) {
      const storedBuf = Buffer.from(hashedCodes[i]);
      if (
        storedBuf.length === inputBuf.length &&
        crypto.timingSafeEqual(storedBuf, inputBuf)
      ) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex === -1) {
      return { isValid: false, remainingHashedCodes: hashedCodes };
    }

    const remaining = [...hashedCodes];
    remaining.splice(matchIndex, 1);
    return { isValid: true, remainingHashedCodes: remaining };
  }
}
