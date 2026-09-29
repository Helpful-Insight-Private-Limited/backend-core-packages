export type NotificationChannel = 'in_app' | 'email' | 'push' | 'webhook' | string;
export type NotificationCategory = 'security' | 'transactional' | 'marketing' | 'system' | string;

export interface NotificationPayload {
  id?: string;
  userId: string;
  category?: NotificationCategory;
  title: string;
  message: string;
  data?: Record<string, any>;
  channels?: NotificationChannel[];
  recipientEmail?: string;
  recipientPushToken?: string;
  webhookUrl?: string;
  createdAt?: Date;
}

export interface ChannelDeliveryResult {
  channel: NotificationChannel;
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface INotificationChannelHandler {
  readonly channelName: NotificationChannel;
  send(notification: NotificationPayload): Promise<ChannelDeliveryResult>;
}
