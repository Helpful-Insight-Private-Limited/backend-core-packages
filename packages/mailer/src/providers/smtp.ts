import nodemailer, { Transporter } from 'nodemailer';
import { IMailProvider, SendMailOptions, SendMailResult } from '../types.js';

export interface SmtpConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  from?: string;
  tls?: Record<string, any>;
}

export class SmtpMailProvider implements IMailProvider {
  readonly name = 'smtp';
  private transporter: Transporter;
  private defaultFrom?: string;

  constructor(config: SmtpConfig) {
    this.defaultFrom = config.from;
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure ?? config.port === 465,
      auth: config.auth,
      tls: config.tls
    });
  }

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from || this.defaultFrom,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        cc: Array.isArray(options.cc) ? options.cc.join(', ') : options.cc,
        bcc: Array.isArray(options.bcc) ? options.bcc.join(', ') : options.bcc,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo,
        attachments: options.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
          path: a.path,
          contentType: a.contentType
        })),
        headers: options.headers
      });

      return {
        success: true,
        messageId: info.messageId,
        provider: this.name
      };
    } catch (err: any) {
      return {
        success: false,
        provider: this.name,
        error: err.message || 'SMTP delivery failed'
      };
    }
  }

  async verifyConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch {
      return false;
    }
  }
}
