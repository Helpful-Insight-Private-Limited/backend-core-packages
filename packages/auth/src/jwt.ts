import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';

export interface AuthTokenPayload {
  sub: string; // User ID
  email?: string;
  roles?: string[];
  permissions?: string[];
  isMfaVerified?: boolean;
  sessionId?: string;
  [key: string]: any;
}

export interface JwtServiceOptions {
  accessSecret: string;
  refreshSecret?: string;
  accessExpiresIn?: string | number; // e.g. '15m'
  refreshExpiresIn?: string | number; // e.g. '7d'
  issuer?: string;
  audience?: string;
}

export class JwtService {
  private accessSecret: string;
  private refreshSecret: string;
  private accessExpiresIn: string | number;
  private refreshExpiresIn: string | number;
  private issuer?: string;
  private audience?: string;

  constructor(options: JwtServiceOptions) {
    this.accessSecret = options.accessSecret;
    this.refreshSecret = options.refreshSecret || options.accessSecret;
    this.accessExpiresIn = options.accessExpiresIn || '15m';
    this.refreshExpiresIn = options.refreshExpiresIn || '7d';
    this.issuer = options.issuer;
    this.audience = options.audience;
  }

  generateAccessToken(payload: AuthTokenPayload, customExpiresIn?: string | number): string {
    const options: SignOptions = {
      expiresIn: (customExpiresIn || this.accessExpiresIn) as any
    };
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return jwt.sign(payload, this.accessSecret, options);
  }

  generateRefreshToken(
    payload: Pick<AuthTokenPayload, 'sub' | 'sessionId'>,
    customExpiresIn?: string | number
  ): string {
    const options: SignOptions = {
      expiresIn: (customExpiresIn || this.refreshExpiresIn) as any
    };
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return jwt.sign(payload, this.refreshSecret, options);
  }

  generateTokenPair(payload: AuthTokenPayload): {
    accessToken: string;
    refreshToken: string;
    expiresInSeconds: number;
  } {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken({
      sub: payload.sub,
      sessionId: payload.sessionId
    });

    return {
      accessToken,
      refreshToken,
      expiresInSeconds: 15 * 60 // 15 mins default
    };
  }

  verifyAccessToken<T = AuthTokenPayload>(token: string): T {
    const options: VerifyOptions = {};
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return jwt.verify(token, this.accessSecret, options) as T;
  }

  verifyRefreshToken<T = AuthTokenPayload>(token: string): T {
    const options: VerifyOptions = {};
    if (this.issuer) options.issuer = this.issuer;
    if (this.audience) options.audience = this.audience;
    return jwt.verify(token, this.refreshSecret, options) as T;
  }
}
