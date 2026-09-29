import { describe, it, expect } from 'vitest';
import { MailService } from './service.js';
import { DevMemoryMailProvider } from './providers/memory.js';

describe('@core/mailer', () => {
  it('should send email using in-memory provider and store it', async () => {
    const memory = new DevMemoryMailProvider();
    const service = new MailService({
      provider: memory,
      defaultFrom: 'test@example.com'
    });

    const result = await service.send({
      to: 'recipient@example.com',
      subject: 'Hello World',
      text: 'This is a test email.'
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('memory');
    expect(result.messageId).toBeDefined();

    const sent = memory.getSentEmails();
    expect(sent.length).toBe(1);
    expect(sent[0].to).toBe('recipient@example.com');
    expect(sent[0].from).toBe('test@example.com');
    expect(sent[0].subject).toBe('Hello World');
  });

  it('should trigger fallback provider if primary fails', async () => {
    const failingPrimary = {
      name: 'broken-provider',
      sendMail: async () => ({ success: false, provider: 'broken-provider', error: 'Server down' })
    };
    const backupMemory = new DevMemoryMailProvider();

    const service = new MailService({
      provider: failingPrimary as any,
      fallbackProvider: backupMemory,
      maxRetries: 0
    });

    const result = await service.send({
      to: 'fallback@example.com',
      subject: 'Failover Test',
      text: 'Should arrive via fallback'
    });

    expect(result.success).toBe(true);
    expect(result.provider).toBe('memory');
    expect(backupMemory.getSentEmails().length).toBe(1);
  });
});
