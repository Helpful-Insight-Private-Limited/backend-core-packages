import { IMailProvider, SendMailOptions, SendMailResult } from '../types.js';

export interface SentMemoryEmail extends SendMailOptions {
  id: string;
  sentAt: Date;
}

export class DevMemoryMailProvider implements IMailProvider {
  readonly name = 'memory';
  private sentEmails: SentMemoryEmail[] = [];

  async sendMail(options: SendMailOptions): Promise<SendMailResult> {
    const id = `mem-${Math.random().toString(36).substring(2, 10)}-${Date.now()}`;
    const record: SentMemoryEmail = {
      ...options,
      id,
      sentAt: new Date()
    };
    this.sentEmails.push(record);

    return {
      success: true,
      messageId: id,
      provider: this.name
    };
  }

  getSentEmails(): SentMemoryEmail[] {
    return [...this.sentEmails];
  }

  getLastEmail(): SentMemoryEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clear(): void {
    this.sentEmails = [];
  }
}
