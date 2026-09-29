import { IMailProvider, SendMailOptions, SendMailResult } from './types.js';
import { SmtpMailProvider, SmtpConfig } from './providers/smtp.js';
import { AwsSesMailProvider, AwsSesConfig } from './providers/ses.js';
import { SendGridMailProvider, SendGridConfig } from './providers/sendgrid.js';
import { MailgunMailProvider, MailgunConfig } from './providers/mailgun.js';
import { DevMemoryMailProvider } from './providers/memory.js';

export interface MailServiceConfig {
  defaultFrom?: string;
  maxRetries?: number;
  provider: IMailProvider;
  fallbackProvider?: IMailProvider;
}

export class MailService {
  private primaryProvider: IMailProvider;
  private fallbackProvider?: IMailProvider;
  private defaultFrom?: string;
  private maxRetries: number;

  constructor(config: MailServiceConfig) {
    this.primaryProvider = config.provider;
    this.fallbackProvider = config.fallbackProvider;
    this.defaultFrom = config.defaultFrom;
    this.maxRetries = config.maxRetries ?? 2;
  }

  static createWithMemory(): { service: MailService; memoryProvider: DevMemoryMailProvider } {
    const memory = new DevMemoryMailProvider();
    const service = new MailService({
      provider: memory,
      defaultFrom: 'no-reply@example.com'
    });
    return { service, memoryProvider: memory };
  }

  async send(options: SendMailOptions): Promise<SendMailResult> {
    const mailOptions: SendMailOptions = {
      ...options,
      from: options.from || this.defaultFrom
    };

    // Attempt with primary provider and retry
    let lastError: string | undefined;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.primaryProvider.sendMail(mailOptions);
        if (result.success) {
          return result;
        }
        lastError = result.error;
      } catch (err: any) {
        lastError = err.message;
      }

      // Small backoff before retry if not last attempt
      if (attempt < this.maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * Math.pow(2, attempt)));
      }
    }

    // Try fallback provider if primary completely failed
    if (this.fallbackProvider) {
      try {
        const fallbackResult = await this.fallbackProvider.sendMail(mailOptions);
        if (fallbackResult.success) {
          return fallbackResult;
        }
        lastError = `Primary failed (${lastError}). Fallback failed (${fallbackResult.error})`;
      } catch (err: any) {
        lastError = `Primary failed (${lastError}). Fallback error: ${err.message}`;
      }
    }

    return {
      success: false,
      provider: this.primaryProvider.name,
      error: lastError || 'All mail sending attempts failed'
    };
  }
}
