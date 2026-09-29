import { IMailProvider, SendMailOptions, SendMailResult } from '../types.js';

export interface SendGridConfig {
  apiKey: string;
  from?: string;
}

export class SendGridMailProvider implements IMailProvider {
  readonly name = 'sendgrid';
  private apiKey: string;
  private defaultFrom?: string;

  constructor(config: SendGridConfig) {
    this.apiKey = config.apiKey;
    this.defaultFrom = config.from;
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const fromEmail = options.from || this.defaultFrom;
      if (!fromEmail) {
        return { success: false, provider: this.name, error: 'From email is required' };
      }

      const toList = Array.isArray(options.to) ? options.to : [options.to];
      const personalizations: any[] = [
        {
          to: toList.map((email) => ({ email: email.trim() }))
        }
      ];

      if (options.cc) {
        const ccList = Array.isArray(options.cc) ? options.cc : [options.cc];
        personalizations[0].cc = ccList.map((email) => ({ email: email.trim() }));
      }

      if (options.bcc) {
        const bccList = Array.isArray(options.bcc) ? options.bcc : [options.bcc];
        personalizations[0].bcc = bccList.map((email) => ({ email: email.trim() }));
      }

      const content: any[] = [];
      if (options.text) {
        content.push({ type: 'text/plain', value: options.text });
      }
      if (options.html) {
        content.push({ type: 'text/html', value: options.html });
      }
      if (content.length === 0) {
        content.push({ type: 'text/plain', value: '' });
      }

      const bodyPayload: any = {
        personalizations,
        from: { email: fromEmail },
        subject: options.subject,
        content
      };

      if (options.replyTo) {
        bodyPayload.reply_to = { email: options.replyTo };
      }

      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodyPayload)
      });

      if (!response.ok) {
        const errText = await response.text();
        return {
          success: false,
          provider: this.name,
          error: `SendGrid API error (${response.status}): ${errText}`
        };
      }

      const messageId = response.headers.get('x-message-id') || `sg-${Date.now()}`;
      return {
        success: true,
        messageId,
        provider: this.name
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err.message || 'SendGrid request failed'
      };
    }
  }
}
