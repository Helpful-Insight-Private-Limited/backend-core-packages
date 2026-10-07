import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';

export interface AuthTokenPayload {
  sub: string; // User ID
  email?: string;
  roles?: string[];
  permissions?: string[];
  isMfaVerified?: boolean;
  sessionId?: string;
  purpose?: string;
  [key: string]: any;
}

export interface JwtServiceOptions {
  accessSecret: string;
  refreshSecret?: string;
  resetSecret?: string;
  accessExpiresIn?: string | number; // e.g. '15m'
  refreshExpiresIn?: string | number; // e.g. '7d'
  resetExpiresIn?: string | number;   // e.g. '15m'
  issuer?: string;
  audience?: string;
}

export class JwtService {
  private accessSecret: string;
  private refreshSecret: string;
  private resetSecret: string;
  private accessExpiresIn: string | number;
  private refreshExpiresIn: string | number;
  private resetExpiresIn: string | number;
  private issuer?: string;
  private audience?: string;

  constructor(options: JwtServiceOptions) {
    this.accessSecret = options.accessSecret;
    this.refreshSecret = options.refreshSecret || options.accessSecret;
    this.resetSecret = options.resetSecret || `${options.accessSecret}_reset_token_secret`;
    this.accessExpiresIn = options.accessExpiresIn || '15m';
    this.refreshExpiresIn = options.refreshExpiresIn || '7d';
    this.resetExpiresIn = options.resetExpiresIn || '15m';
    this.issuer = options.issuer;
    this.audience = options.audience;
  }

  generateAccessToken(payload: AuthTokenPayload, customExpiresIn?: string | number): string {
    const options: SignOptions = {
      expiresIn: (customExpiresIn || this.accessExpiresIn) as any,
      jwtid: Math.random().toString(36).substring(2) + Date.now().toString(36)
    };
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return jwt.sign({ purpose: 'access', ...payload }, this.accessSecret, options);
  }

  generateRefreshToken(
    payload: Pick<AuthTokenPayload, 'sub' | 'sessionId'> & { isMfaVerified?: boolean; [key: string]: any },
    customExpiresIn?: string | number
  ): string {
    const options: SignOptions = {
      expiresIn: (customExpiresIn || this.refreshExpiresIn) as any,
      jwtid: Math.random().toString(36).substring(2) + Date.now().toString(36)
    };
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return jwt.sign({ purpose: 'refresh', ...payload }, this.refreshSecret, options);
  }

  generateTokenPair(payload: AuthTokenPayload): {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  } {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      sub: payload.sub,
      sessionId: payload.sessionId,
      isMfaVerified: payload.isMfaVerified
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: 15 * 60 // 15 mins default
    };
  }

  verifyAccessToken<T = AuthTokenPayload>(token: string, allowedPurposes: string[] = ['access']): T {
    const options: VerifyOptions = {};
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    const payload = jwt.verify(token, this.accessSecret, options) as any;
    if (payload.purpose && !allowedPurposes.includes(payload.purpose)) {
      throw new Error('Token is not valid for access (invalid purpose)');
    }
    return payload as T;
  }

  verifyRefreshToken<T = AuthTokenPayload>(token: string): T {
    const options: VerifyOptions = {};
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    const payload = jwt.verify(token, this.refreshSecret, options) as any;
    if (payload.purpose !== 'refresh') {
      throw new Error('Token is not valid for token refresh (invalid purpose)');
    }
    return payload as T;
  }

  generateResetToken(payload: AuthTokenPayload, customExpiresIn?: string | number): string {
    const options: SignOptions = {
      expiresIn: (customExpiresIn || this.resetExpiresIn) as any,
      jwtid: Math.random().toString(36).substring(2) + Date.now().toString(36)
    };
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return jwt.sign({ ...payload, purpose: 'password_reset' }, this.resetSecret, options);
  }

  verifyResetToken<T = AuthTokenPayload>(token: string): T {
    const options: VerifyOptions = {};
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    const payload = jwt.verify(token, this.resetSecret, options) as any;
    if (payload.purpose !== 'password_reset') {
      throw new Error('Token is not valid for password reset');
    }
    return payload as T;
  }
}
