import {
  INotificationChannelHandler,
  NotificationPayload,
  ChannelDeliveryResult,
  NotificationChannel
} from './types.js';
import { IPreferencesStore, MemoryPreferencesStore } from './preferences.js';
import { InAppChannelHandler } from './channels/in-app.js';

export interface NotificationServiceOptions {
  preferencesStore?: IPreferencesStore;
  defaultChannels?: NotificationChannel[];
}

export class NotificationService {
  private handlers: Map<NotificationChannel, INotificationChannelHandler> = new Map();
  private preferencesStore: IPreferencesStore;
  private defaultChannels: NotificationChannel[];

  constructor(options: NotificationServiceOptions = {}) {
    this.preferencesStore = options.preferencesStore || new MemoryPreferencesStore();
    this.defaultChannels = options.defaultChannels || ['in_app'];

    // Register built-in in-app handler by default
    this.registerHandler(new InAppChannelHandler());
  }

  registerHandler(handler: INotificationChannelHandler): void {
    this.handlers.set(handler.channelName, handler);
  }

  getInAppHandler(): InAppChannelHandler | undefined {
    return this.handlers.get('in_app') as InAppChannelHandler | undefined;
  }

  getPreferencesStore(): IPreferencesStore {
    return this.preferencesStore;
  }

  async send(notification: NotificationPayload): Promise<{
    id: string;
    results: ChannelDeliveryResult[];
  }> {
    const id = notification.id || `notif_${Math.random().toString(36).substring(2, 11)}_${Date.now()}`;
    const payload: NotificationPayload = {
      ...notification,
      id,
      category: notification.category || 'system'
    };

    const targetChannels = payload.channels || this.defaultChannels;
    const results: ChannelDeliveryResult[] = [];

    const deliveryPromises = targetChannels.map(async (channelName) => {
      // 1. Check user preference
      const isEnabled = await this.preferencesStore.isChannelEnabled(
        payload.userId,
        payload.category!,
        channelName
      );

      if (!isEnabled) {
        return {
          channel: channelName,
          success: false,
          error: `Muted by user channel preference for category '${payload.category}'`
        };
      }

      // 2. Locate handler
      const handler = this.handlers.get(channelName);
      if (!handler) {
        return {
          channel: channelName,
          success: false,
          error: `No handler registered for channel '${channelName}'`
        };
      }

      // 3. Dispatch
      return handler.send(payload);
    });

    const settled = await Promise.all(deliveryPromises);
    results.push(...settled);

    return { id, results };
  }
}
