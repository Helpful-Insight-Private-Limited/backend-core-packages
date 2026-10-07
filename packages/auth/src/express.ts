import { Request, Response, NextFunction, RequestHandler } from 'express';
import { JwtService, AuthTokenPayload } from './jwt.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export interface AuthenticateJwtOptions {
  allowAnonymous?: boolean;
  getToken?: (req: Request) => string | undefined;
  allowedPurposes?: string[];
}

export function createAuthMiddleware(
  jwtService: JwtService,
  defaultOptions: AuthenticateJwtOptions = {}
) {
  const authenticateJwt = (options: AuthenticateJwtOptions = {}): RequestHandler => {
    const opts = { ...defaultOptions, ...options };
    const allowedPurposes = opts.allowedPurposes || ['access'];

    return (req: Request, res: Response, next: NextFunction): void => {
      let token: string | undefined;

      if (opts.getToken) {
        token = opts.getToken(req);
      } else if (req.headers.authorization) {
        const parts = req.headers.authorization.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
          token = parts[1];
        }
      }

      if (!token) {
        if (opts.allowAnonymous) {
          return next();
        }
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication token missing or invalid Bearer format'
          }
        });
        return;
      }

      try {
        const payload = jwtService.verifyAccessToken<AuthTokenPayload>(token, allowedPurposes);

        // Reject tokens with unauthorized purpose
        if (payload.purpose && !allowedPurposes.includes(payload.purpose)) {
          res.status(401).json({
            success: false,
            error: {
              code: 'INVALID_TOKEN_PURPOSE',
              message: 'Token cannot be used for session authentication'
            }
          });
          return;
        }

        req.user = payload;
        next();
      } catch (err: any) {
        if (opts.allowAnonymous) {
          return next();
        }
        const isPurposeError = err.message && err.message.includes('invalid purpose');
        res.status(401).json({
          success: false,
          error: {
            code: isPurposeError ? 'INVALID_TOKEN_PURPOSE' : 'TOKEN_EXPIRED_OR_INVALID',
            message: err.message || 'Token is invalid or has expired'
          }
        });
      }
    };
  };

  const requireMfaVerification = (): RequestHandler => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
        });
        return;
      }

      if (req.user.isMfaEnabled && !req.user.isMfaVerified) {
        res.status(403).json({
          success: false,
          error: {
            code: 'MFA_REQUIRED',
            message: 'Two-Factor Authentication verification is required to access this resource'
          }
        });
        return;
      }

      next();
    };
  };

  return {
    authenticateJwt,
    requireMfaVerification
  };
}
