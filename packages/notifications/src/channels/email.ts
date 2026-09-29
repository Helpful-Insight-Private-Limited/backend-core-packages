import {
  INotificationChannelHandler,
  NotificationPayload,
  ChannelDeliveryResult
} from '../types.js';

export type MailSenderFn = (options: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) => Promise<{ success: boolean; messageId?: string; error?: string }>;

export class EmailNotificationHandler implements INotificationChannelHandler {
  readonly channelName = 'email';

  constructor(private mailSender: MailSenderFn) {}

  async send(notification: NotificationPayload): Promise<ChannelDeliveryResult> {
    if (!notification.recipientEmail) {
      return {
        channel: this.channelName,
        success: false,
        error: 'Recipient email address not provided'
      };
    }

    try {
      const result = await this.mailSender({
        to: notification.recipientEmail,
        subject: notification.title,
        text: notification.message,
        html: `<p>${notification.message}</p>`
      });

      return {
        channel: this.channelName,
        success: result.success,
        messageId: result.messageId,
        error: result.error
      };
    } catch (err: any) {
      return {
        channel: this.channelName,
        success: false,
        error: err.message || 'Email delivery failed'
      };
    }
  }
}
