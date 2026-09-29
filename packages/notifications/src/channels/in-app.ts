import { EventEmitter } from 'events';
import {
  INotificationChannelHandler,
  NotificationPayload,
  ChannelDeliveryResult
} from '../types.js';

export interface InAppNotificationRecord {
  id: string;
  userId: string;
  category: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
}

export interface IInAppStore {
  save(notification: InAppNotificationRecord): Promise<void>;
  getUserNotifications(userId: string, unreadOnly?: boolean): Promise<InAppNotificationRecord[]>;
  markAsRead(id: string, userId: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<number>;
}

export class MemoryInAppStore implements IInAppStore {
  private notifications: Map<string, InAppNotificationRecord> = new Map();

  async save(notification: InAppNotificationRecord): Promise<void> {
    this.notifications.set(notification.id, { ...notification });
  }

  async getUserNotifications(
    userId: string,
    unreadOnly = false
  ): Promise<InAppNotificationRecord[]> {
    const list = Array.from(this.notifications.values()).filter(
      (n) => n.userId === userId && (!unreadOnly || !n.isRead)
    );
    return list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    const item = this.notifications.get(id);
    if (item && item.userId === userId) {
      item.isRead = true;
      item.readAt = new Date();
      return true;
    }
    return false;
  }

  async markAllAsRead(userId: string): Promise<number> {
    let count = 0;
    for (const item of this.notifications.values()) {
      if (item.userId === userId && !item.isRead) {
        item.isRead = true;
        item.readAt = new Date();
        count++;
      }
    }
    return count;
  }
}

export class PrismaInAppStore implements IInAppStore {
  constructor(private prisma: any) {}

  async save(notification: InAppNotificationRecord): Promise<void> {
    if (!this.prisma?.notification) return;
    await this.prisma.notification.create({
      data: {
        id: notification.id,
        userId: notification.userId,
        category: notification.category,
        title: notification.title,
        message: notification.message,
        data: notification.data ? JSON.stringify(notification.data) : null,
        isRead: notification.isRead,
        createdAt: notification.createdAt
      }
    });
  }

  async getUserNotifications(
    userId: string,
    unreadOnly = false
  ): Promise<InAppNotificationRecord[]> {
    if (!this.prisma?.notification) return [];
    const where: any = { userId };
    if (unreadOnly) where.isRead = false;

    const rows = await this.prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return rows.map((r: any) => ({
      id: r.id,
      userId: r.userId,
      category: r.category,
      title: r.title,
      message: r.message,
      data: r.data ? JSON.parse(r.data) : undefined,
      isRead: r.isRead,
      readAt: r.readAt,
      createdAt: r.createdAt
    }));
  }

  async markAsRead(id: string, userId: string): Promise<boolean> {
    if (!this.prisma?.notification) return false;
    try {
      await this.prisma.notification.update({
        where: { id, userId },
        data: { isRead: true, readAt: new Date() }
      });
      return true;
    } catch {
      return false;
    }
  }

  async markAllAsRead(userId: string): Promise<number> {
    if (!this.prisma?.notification) return 0;
    const res = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() }
    });
    return res.count;
  }
}

export class InAppChannelHandler implements INotificationChannelHandler {
  readonly channelName = 'in_app';
  private emitter = new EventEmitter();

  constructor(private store: IInAppStore = new MemoryInAppStore()) {}

  getStore(): IInAppStore {
    return this.store;
  }

  async send(notification: NotificationPayload): Promise<ChannelDeliveryResult> {
    const record: InAppNotificationRecord = {
      id: notification.id || `notif_${Math.random().toString(36).substring(2, 11)}`,
      userId: notification.userId,
      category: notification.category || 'system',
      title: notification.title,
      message: notification.message,
      data: notification.data,
      isRead: false,
      createdAt: new Date()
    };

    await this.store.save(record);

    // Emit live event for connected SSE clients
    this.emitter.emit(`user:${notification.userId}`, record);

    return {
      channel: this.channelName,
      success: true,
      messageId: record.id
    };
  }

  subscribe(userId: string, callback: (notification: InAppNotificationRecord) => void): () => void {
    const eventName = `user:${userId}`;
    this.emitter.on(eventName, callback);
    return () => {
      this.emitter.off(eventName, callback);
    };
  }
}
