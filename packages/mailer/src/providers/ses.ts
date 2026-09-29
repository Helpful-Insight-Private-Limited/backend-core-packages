import nodemailer, { Transporter } from 'nodemailer';
import { IMailProvider, SendMailOptions, SendMailResult } from '../types.js';

export interface AwsSesConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  from?: string;
  /**
   * If using standard SES SMTP credentials (recommended by AWS)
   */
  smtpHost?: string;
  smtpPort?: number;
}

export class AwsSesMailProvider implements IMailProvider {
  readonly name = 'aws-ses';
  private transporter: Transporter;
  private defaultFrom?: string;

  constructor(config: AwsSesConfig) {
    this.defaultFrom = config.from;
    const host = config.smtpHost || `email-smtp.${config.region}.amazonaws.com`;
    const port = config.smtpPort || 465;

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: config.accessKeyId && config.secretAccessKey
        ? {
            user: config.accessKeyId,
            pass: config.secretAccessKey
          }
        : undefined
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
        error: err.message || 'AWS SES delivery failed'
      };
    }
  }
}
