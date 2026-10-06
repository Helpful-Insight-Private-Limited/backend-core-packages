import { Request, Router, RequestHandler } from 'express';

declare class PasswordHash {
    static hash(plainPassword: string, rounds?: number): Promise<string>;
    static compare(plainPassword: string, hash: string): Promise<boolean>;
}

interface AuthTokenPayload {
    sub: string;
    email?: string;
    roles?: string[];
    permissions?: string[];
    isMfaVerified?: boolean;
    sessionId?: string;
    [key: string]: any;
}
interface JwtServiceOptions {
    accessSecret: string;
    refreshSecret?: string;
    resetSecret?: string;
    accessExpiresIn?: string | number;
    refreshExpiresIn?: string | number;
    resetExpiresIn?: string | number;
    issuer?: string;
    audience?: string;
}
declare class JwtService {
    private accessSecret;
    private refreshSecret;
    private resetSecret;
    private accessExpiresIn;
    private refreshExpiresIn;
    private resetExpiresIn;
    private issuer?;
    private audience?;
    constructor(options: JwtServiceOptions);
    generateAccessToken(payload: AuthTokenPayload, customExpiresIn?: string | number): string;
    generateRefreshToken(payload: Pick<AuthTokenPayload, 'sub' | 'sessionId'>, customExpiresIn?: string | number): string;
    generateTokenPair(payload: AuthTokenPayload): {
        accessToken: string;
        refreshToken: string;
        expiresInSeconds: number;
    };
    verifyAccessToken<T = AuthTokenPayload>(token: string): T;
    verifyRefreshToken<T = AuthTokenPayload>(token: string): T;
    generateResetToken(payload: AuthTokenPayload, customExpiresIn?: string | number): string;
    verifyResetToken<T = AuthTokenPayload>(token: string): T;
}

declare class TotpService {
    /**
     * Generate a random base32 encoded secret for Google Authenticator.
     */
    static generateSecret(byteLength?: number): string;
    /**
     * Decode base32 secret to Buffer.
     */
    private static base32Decode;
    /**
     * Generate 6-digit TOTP token for given time (RFC 6238).
     */
    static generateToken(secret: string, timestampMs?: number, timeStepSec?: number): string;
    /**
     * Verify token with ±1 window tolerance (60s total window).
     */
    static verifyToken(token: string, secret: string, options?: {
        window?: number;
        timestampMs?: number;
        timeStepSec?: number;
    }): boolean;
    /**
     * Build the otpauth URI for QR codes.
     */
    static getOtpAuthUri(options: {
        issuer: string;
        accountName: string;
        secret: string;
    }): string;
    /**
     * Generate emergency recovery backup codes (e.g. 10 codes).
     */
    static generateBackupCodes(count?: number): string[];
}

interface OAuthProfile {
    provider: 'google' | 'github';
    providerId: string;
    email: string;
    name?: string;
    avatarUrl?: string;
}
declare class GoogleOAuthHelper {
    private clientId;
    private clientSecret;
    private redirectUri;
    constructor(clientId: string, clientSecret: string, redirectUri: string);
    getAuthorizationUrl(state?: string, scopes?: string[]): string;
    exchangeCode(code: string): Promise<OAuthProfile>;
}
declare class GithubOAuthHelper {
    private clientId;
    private clientSecret;
    private redirectUri;
    constructor(clientId: string, clientSecret: string, redirectUri: string);
    getAuthorizationUrl(state?: string, scopes?: string[]): string;
    exchangeCode(code: string): Promise<OAuthProfile>;
}

interface StoredRefreshToken {
    id: string;
    token: string;
    userId: string;
    expiresAt: Date;
    isRevoked: boolean;
    deviceInfo?: string;
    createdAt: Date;
}
interface ISessionStore {
    saveRefreshToken(userId: string, token: string, expiresAt: Date, deviceInfo?: string): Promise<StoredRefreshToken>;
    findRefreshToken(token: string): Promise<StoredRefreshToken | null>;
    rotateRefreshToken(oldToken: string, newToken: string, newExpiresAt: Date): Promise<StoredRefreshToken | null>;
    revokeRefreshToken(token: string): Promise<boolean>;
    revokeAllUserSessions(userId: string): Promise<number>;
}
declare class MemorySessionStore implements ISessionStore {
    private tokens;
    saveRefreshToken(userId: string, token: string, expiresAt: Date, deviceInfo?: string): Promise<StoredRefreshToken>;
    findRefreshToken(token: string): Promise<StoredRefreshToken | null>;
    rotateRefreshToken(oldToken: string, newToken: string, newExpiresAt: Date): Promise<StoredRefreshToken | null>;
    revokeRefreshToken(token: string): Promise<boolean>;
    revokeAllUserSessions(userId: string): Promise<number>;
}
declare class PrismaSessionStore implements ISessionStore {
    private prisma;
    constructor(prisma: any);
    saveRefreshToken(userId: string, token: string, expiresAt: Date, deviceInfo?: string): Promise<StoredRefreshToken>;
    findRefreshToken(token: string): Promise<StoredRefreshToken | null>;
    rotateRefreshToken(oldToken: string, newToken: string, newExpiresAt: Date): Promise<StoredRefreshToken | null>;
    revokeRefreshToken(token: string): Promise<boolean>;
    revokeAllUserSessions(userId: string): Promise<number>;
}

interface AuthUser {
    id: string;
    email: string;
    passwordHash?: string | null;
    name?: string | null;
    phone?: string | null;
    roles?: string[];
    isMfaEnabled?: boolean;
    mfaSecret?: string | null;
    mfaBackupCodes?: string | null;
    [key: string]: any;
}
interface IAuthUserStore {
    findByEmail(email: string): Promise<AuthUser | null>;
    findById(id: string): Promise<AuthUser | null>;
    create(data: {
        email: string;
        passwordHash: string;
        name?: string;
        phone?: string;
        role?: string;
    }): Promise<AuthUser>;
    updatePassword(userId: string, newPasswordHash: string): Promise<void>;
    updateMfa(userId: string, data: {
        isMfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaBackupCodes?: string | null;
    }): Promise<void>;
}
declare class MemoryAuthUserStore implements IAuthUserStore {
    private users;
    findByEmail(email: string): Promise<AuthUser | null>;
    findById(id: string): Promise<AuthUser | null>;
    create(data: {
        email: string;
        passwordHash: string;
        name?: string;
        phone?: string;
        role?: string;
    }): Promise<AuthUser>;
    updatePassword(userId: string, newPasswordHash: string): Promise<void>;
    updateMfa(userId: string, data: {
        isMfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaBackupCodes?: string | null;
    }): Promise<void>;
}
declare class PrismaAuthUserStore implements IAuthUserStore {
    private prisma;
    constructor(prisma: any);
    findByEmail(email: string): Promise<AuthUser | null>;
    findById(id: string): Promise<AuthUser | null>;
    create(data: {
        email: string;
        passwordHash: string;
        name?: string;
        phone?: string;
        role?: string;
    }): Promise<AuthUser>;
    updatePassword(userId: string, newPasswordHash: string): Promise<void>;
    updateMfa(userId: string, data: {
        isMfaEnabled?: boolean;
        mfaSecret?: string | null;
        mfaBackupCodes?: string | null;
    }): Promise<void>;
    private mapPrismaUser;
}

interface SendMailHookOptions {
    to: string;
    subject: string;
    resetUrl: string;
    resetToken: string;
    userName?: string;
}
interface AuthRouterOptions {
    prisma?: any;
    userStore?: IAuthUserStore;
    jwtService: JwtService;
    sessionStore?: ISessionStore;
    onSendPasswordResetMail?: (options: SendMailHookOptions) => Promise<void>;
    resetPasswordUrl?: string;
    resetTokenExpiresIn?: string | number;
    defaultRole?: string;
    jwtResetSecret?: string;
    onUserRegistered?: (user: any, req: Request) => Promise<void> | void;
    onUserLoggedIn?: (user: any, req: Request) => Promise<void> | void;
    onPasswordReset?: (user: any, req: Request) => Promise<void> | void;
}
declare function createAuthRouter(options: AuthRouterOptions): Router;

declare const PRISMA_AUTH_SCHEMA_SNIPPET = "\nmodel User {\n  id              String         @id @default(uuid())\n  email           String         @unique\n  passwordHash    String?\n  name            String?\n  avatarUrl       String?\n  isEmailVerified Boolean        @default(false)\n  isMfaEnabled    Boolean        @default(false)\n  mfaSecret       String?\n  mfaBackupCodes  String?        // JSON array of strings\n  googleId        String?        @unique\n  githubId        String?        @unique\n  refreshTokens   RefreshToken[]\n  roles           UserRole[]\n  createdAt       DateTime       @default(now())\n  updatedAt       DateTime       @updatedAt\n}\n\nmodel RefreshToken {\n  id         String   @id @default(uuid())\n  token      String   @unique\n  userId     String\n  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)\n  deviceInfo String?\n  isRevoked  Boolean  @default(false)\n  expiresAt  DateTime\n  createdAt  DateTime @default(now())\n}\n";

declare global {
    namespace Express {
        interface Request {
            user?: AuthTokenPayload;
        }
    }
}
interface AuthenticateJwtOptions {
    allowAnonymous?: boolean;
    getToken?: (req: Request) => string | undefined;
}
declare function createAuthMiddleware(jwtService: JwtService, defaultOptions?: AuthenticateJwtOptions): {
    authenticateJwt: (options?: AuthenticateJwtOptions) => RequestHandler;
    requireMfaVerification: () => RequestHandler;
};

export { type AuthRouterOptions, type AuthTokenPayload, type AuthUser, type AuthenticateJwtOptions, GithubOAuthHelper, GoogleOAuthHelper, type IAuthUserStore, type ISessionStore, JwtService, type JwtServiceOptions, MemoryAuthUserStore, MemorySessionStore, type OAuthProfile, PRISMA_AUTH_SCHEMA_SNIPPET, PasswordHash, PrismaAuthUserStore, PrismaSessionStore, type SendMailHookOptions, type StoredRefreshToken, TotpService, createAuthMiddleware, createAuthRouter };
