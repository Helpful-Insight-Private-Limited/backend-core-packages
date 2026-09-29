import { EmailTemplate } from './types.js';

export const BASE_STYLE = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  line-height: 1.6;
  color: #1a202c;
  background-color: #f7fafc;
  margin: 0;
  padding: 0;
`;

export const WRAPPER_HTML = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{subject}}</title>
</head>
<body style="${BASE_STYLE}">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f7fafc; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; border: 1px solid #e2e8f0;">
          <tr>
            <td style="padding: 32px 40px; text-align: left;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 40px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 13px; color: #718096; text-align: center;">
              © {{year}} {{companyName}}. All rights reserved.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export const DEFAULT_TEMPLATES: EmailTemplate[] = [
  {
    name: 'welcome',
    subject: 'Welcome to {{companyName}}, {{userName}}!',
    description: 'Sent when a new user signs up or is onboarded.',
    isSystem: true,
    variables: ['companyName', 'userName', 'actionUrl', 'year'],
    html: WRAPPER_HTML(`
      <h2 style="color: #2b6cb0; margin-top: 0; font-size: 24px;">Welcome aboard, {{userName}}! 🎉</h2>
      <p style="font-size: 16px; color: #4a5568;">
        We're thrilled to have you join us at <strong>{{companyName}}</strong>. Your account is now active and ready to go.
      </p>
      <div style="margin: 32px 0; text-align: center;">
        <a href="{{{actionUrl}}}" style="background-color: #3182ce; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          Get Started
        </a>
      </div>
      <p style="font-size: 14px; color: #718096;">
        If you have any questions, simply reply directly to this email.
      </p>
    `),
    text: 'Welcome to {{companyName}}, {{userName}}!\n\nYour account is ready. Get started here: {{{actionUrl}}}'
  },
  {
    name: 'forgot-password',
    subject: 'Reset your password for {{companyName}}',
    description: 'Sent when a user requests a password reset link.',
    isSystem: true,
    variables: ['companyName', 'userName', 'resetUrl', 'expiryMinutes', 'year'],
    html: WRAPPER_HTML(`
      <h2 style="color: #2d3748; margin-top: 0; font-size: 24px;">Password Reset Request 🔐</h2>
      <p style="font-size: 16px; color: #4a5568;">
        Hello {{userName}}, we received a request to reset your password for your <strong>{{companyName}}</strong> account.
      </p>
      <div style="margin: 32px 0; text-align: center;">
        <a href="{{{resetUrl}}}" style="background-color: #e53e3e; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">
          Reset My Password
        </a>
      </div>
      <p style="font-size: 14px; color: #718096;">
        This link will expire in <strong>{{expiryMinutes}} minutes</strong>. If you did not make this request, you can safely ignore this email.
      </p>
    `),
    text: 'Hello {{userName}},\n\nReset your password here: {{{resetUrl}}}\nThis link expires in {{expiryMinutes}} minutes.'
  },
  {
    name: 'reset-success',
    subject: 'Your {{companyName}} password was successfully changed',
    description: 'Sent when password reset or update completes.',
    isSystem: true,
    variables: ['companyName', 'userName', 'year'],
    html: WRAPPER_HTML(`
      <h2 style="color: #38a169; margin-top: 0; font-size: 24px;">Password Successfully Changed ✅</h2>
      <p style="font-size: 16px; color: #4a5568;">
        Hello {{userName}}, your password for <strong>{{companyName}}</strong> has been updated.
      </p>
      <p style="font-size: 14px; color: #e53e3e; background-color: #fff5f5; padding: 12px; border-radius: 6px; border-left: 4px solid #e53e3e;">
        <strong>Security Notice:</strong> If you did not make this change, please contact our support team immediately.
      </p>
    `),
    text: 'Hello {{userName}},\n\nYour password for {{companyName}} was successfully changed. If you did not perform this action, please contact support immediately.'
  },
  {
    name: 'verify-email',
    subject: 'Verify your email address - {{companyName}}',
    description: 'Sent to verify user email address with OTP and link.',
    isSystem: true,
    variables: ['companyName', 'userName', 'verifyUrl', 'otpCode', 'year'],
    html: WRAPPER_HTML(`
      <h2 style="color: #2b6cb0; margin-top: 0; font-size: 24px;">Verify Your Email Address ✉️</h2>
      <p style="font-size: 16px; color: #4a5568;">
        Hello {{userName}}, please use the verification code below to verify your email address:
      </p>
      <div style="margin: 24px 0; text-align: center;">
        <span style="display: inline-block; font-family: monospace; font-size: 32px; font-weight: bold; letter-spacing: 6px; background-color: #ebf8ff; color: #2b6cb0; padding: 12px 24px; border-radius: 8px; border: 1px dashed #3182ce;">
          {{otpCode}}
        </span>
      </div>
      <p style="text-align: center; font-size: 14px; color: #4a5568;">
        Or click the button below:
      </p>
      <div style="margin: 20px 0; text-align: center;">
        <a href="{{{verifyUrl}}}" style="background-color: #3182ce; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">
          Verify Email Now
        </a>
      </div>
    `),
    text: 'Hello {{userName}},\n\nYour verification code is: {{otpCode}}\nOr verify via this link: {{{verifyUrl}}}'
  }
];
