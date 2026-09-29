import { describe, it, expect } from 'vitest';
import { EmailTemplateEngine } from './engine.js';
import { MemoryTemplateStore } from './stores/memory.js';

describe('@core/email-templates', () => {
  it('should render default welcome template with variable interpolation', async () => {
    const engine = new EmailTemplateEngine();
    const rendered = await engine.render('welcome', {
      userName: 'Alice',
      companyName: 'TechCorp',
      actionUrl: 'https://example.com/welcome'
    });

    expect(rendered.subject).toContain('Alice');
    expect(rendered.subject).toContain('TechCorp');
    expect(rendered.html).toContain('Welcome aboard, Alice!');
    expect(rendered.html).toContain('https://example.com/welcome');
    expect(rendered.text).toContain('Alice');
  });

  it('should render forgot-password template correctly', async () => {
    const engine = new EmailTemplateEngine();
    const rendered = await engine.render('forgot-password', {
      userName: 'Bob',
      companyName: 'TechCorp',
      resetUrl: 'https://example.com/reset?token=xyz',
      expiryMinutes: 20
    });

    expect(rendered.subject).toContain('Reset your password');
    expect(rendered.html).toContain('20 minutes');
    expect(rendered.html).toContain('https://example.com/reset?token=xyz');
  });

  it('should allow adding and rendering custom new templates', async () => {
    const store = new MemoryTemplateStore();
    const engine = new EmailTemplateEngine({ store });

    await engine.saveTemplate({
      name: 'invoice-receipt',
      subject: 'Invoice #{{invoiceId}} for {{clientName}}',
      html: '<p>Thank you for paying ${{amount}}</p>',
      isSystem: false
    });

    const rendered = await engine.render('invoice-receipt', {
      invoiceId: 'INV-1001',
      clientName: 'Acme LLC',
      amount: '299.00'
    });

    expect(rendered.subject).toBe('Invoice #INV-1001 for Acme LLC');
    expect(rendered.html).toBe('<p>Thank you for paying $299.00</p>');
  });
});
