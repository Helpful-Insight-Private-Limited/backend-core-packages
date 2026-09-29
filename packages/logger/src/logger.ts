import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

export interface AppLoggerOptions {
  level?: string;
  name?: string;
  redactPaths?: string[];
  prettyPrint?: boolean;
}

export class AppLogger {
  private pinoInstance: PinoLogger;

  constructor(options: AppLoggerOptions = {}) {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const level = options.level || process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

    const redact = options.redactPaths || [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      'refreshToken',
      'accessToken',
      'secret',
      'creditCard',
      'cvv'
    ];

    const pinoOptions: LoggerOptions = {
      level,
      name: options.name || 'api',
      redact: {
        paths: redact,
        censor: '[REDACTED]'
      },
      timestamp: pino.stdTimeFunctions.isoTime
    };

    if (options.prettyPrint ?? isDevelopment) {
      // Use transport for pino v9
      pinoOptions.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      };
    }

    this.pinoInstance = pino(pinoOptions);
  }

  public getRawLogger(): PinoLogger {
    return this.pinoInstance;
  }

  public info(msg: string, obj?: any): void {
    if (obj) this.pinoInstance.info(obj, msg);
    else this.pinoInstance.info(msg);
  }

  public warn(msg: string, obj?: any): void {
    if (obj) this.pinoInstance.warn(obj, msg);
    else this.pinoInstance.warn(msg);
  }

  public error(msg: string, err?: any): void {
    if (err) this.pinoInstance.error({ err }, msg);
    else this.pinoInstance.error(msg);
  }

  public debug(msg: string, obj?: any): void {
    if (obj) this.pinoInstance.debug(obj, msg);
    else this.pinoInstance.debug(msg);
  }

  public child(bindings: Record<string, any>): PinoLogger {
    return this.pinoInstance.child(bindings);
  }
}

export const defaultLogger = new AppLogger();
