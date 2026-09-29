import { IMailProvider, SendMailOptions, SendMailResult } from '../types.js';

export interface MailgunConfig {
  apiKey: string;
  domain: string;
  region?: 'us' | 'eu';
  from?: string;
}

export class MailgunMailProvider implements IMailProvider {
  readonly name = 'mailgun';
  private apiKey: string;
  private domain: string;
  private baseUrl: string;
  private defaultFrom?: string;

  constructor(config: MailgunConfig) {
    this.apiKey = config.apiKey;
    this.domain = config.domain;
    this.defaultFrom = config.from;
    const host = config.region === 'eu' ? 'api.eu.mailgun.net' : 'api.mailgun.net';
    this.baseUrl = `https://${host}/v3/${this.domain}/messages`;
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const fromEmail = options.from || this.defaultFrom;
      if (!fromEmail) {
        return { success: false, provider: this.name, error: 'From email is required' };
      }

      const params = new URLSearchParams();
      params.append('from', fromEmail);

      const toList = Array.isArray(options.to) ? options.to.join(',') : options.to;
      params.append('to', toList);

      if (options.cc) {
        const ccList = Array.isArray(options.cc) ? options.cc.join(',') : options.cc;
        params.append('cc', ccList);
      }

      if (options.bcc) {
        const bccList = Array.isArray(options.bcc) ? options.bcc.join(',') : options.bcc;
        params.append('bcc', bccList);
      }

      params.append('subject', options.subject);

      if (options.text) {
        params.append('text', options.text);
      }
      if (options.html) {
        params.append('html', options.html);
      }
      if (options.replyTo) {
        params.append('h:Reply-To', options.replyTo);
      }

      const authHeader = `Basic ${Buffer.from(`api:${this.apiKey}`).toString('base64')}`;

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          provider: this.name,
          error: `Mailgun API error (${response.status}): ${errorText}`
        };
      }

      const result = (await response.json()) as { id?: string; message?: string };
      return {
        success: true,
        messageId: result.id || `mg-${Date.now()}`,
        provider: this.name
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err.message || 'Mailgun request failed'
      };
    }
  }
}
