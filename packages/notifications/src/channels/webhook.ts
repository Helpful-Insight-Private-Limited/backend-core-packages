import * as crypto from 'crypto';
import {
  INotificationChannelHandler,
  NotificationPayload,
  ChannelDeliveryResult
} from '../types.js';

export interface WebhookChannelOptions {
  secret?: string;
  defaultWebhookUrl?: string;
  timeoutMs?: number;
}

export class WebhookChannelHandler implements INotificationChannelHandler {
  readonly channelName = 'webhook';
  private secret: string;
  private defaultWebhookUrl?: string;
  private timeoutMs: number;

  constructor(options: WebhookChannelOptions = {}) {
    this.secret = options.secret || 'default-webhook-secret';
    this.defaultWebhookUrl = options.defaultWebhookUrl;
    this.timeoutMs = options.timeoutMs || 5000;
  }

  async send(notification: NotificationPayload): Promise<ChannelDeliveryResult> {
    const targetUrl = notification.webhookUrl || this.defaultWebhookUrl;
    if (!targetUrl) {
      return {
        channel: this.channelName,
        success: false,
        error: 'No webhook URL provided in payload or default configuration'
      };
    }

    const payload = JSON.stringify({
      id: notification.id,
      event: `notification.${notification.category || 'general'}`,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      timestamp: new Date().toISOString()
    });

    const signature = crypto
      .createHmac('sha256', this.secret)
      .update(payload)
      .digest('hex');

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
          'x-webhook-timestamp': Date.now().toString()
        },
        body: payload,
        signal: controller.signal
      });
      clearTimeout(timer);

      if (!res.ok) {
        return {
          channel: this.channelName,
          success: false,
          error: `Webhook receiver returned status ${res.status}`
        };
      }

      return {
        channel: this.channelName,
        success: true,
        messageId: `wh_${Date.now()}`
      };
    } catch (err: any) {
      return {
        channel: this.channelName,
        success: false,
        error: err.message || 'Webhook dispatch failed'
      };
    }
  }
}
