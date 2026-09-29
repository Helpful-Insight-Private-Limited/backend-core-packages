import { Router } from 'express';

type NotificationChannel = 'in_app' | 'email' | 'push' | 'webhook' | string;
type NotificationCategory = 'security' | 'transactional' | 'marketing' | 'system' | string;
interface NotificationPayload {
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
interface ChannelDeliveryResult {
    channel: NotificationChannel;
    success: boolean;
    messageId?: string;
    error?: string;
}
interface INotificationChannelHandler {
    readonly channelName: NotificationChannel;
    send(notification: NotificationPayload): Promise<ChannelDeliveryResult>;
}

interface UserChannelPreference {
    userId: string;
    category: NotificationCategory;
    channel: NotificationChannel;
    enabled: boolean;
}
interface IPreferencesStore {
    isChannelEnabled(userId: string, category: NotificationCategory, channel: NotificationChannel): Promise<boolean>;
    setPreference(userId: string, category: NotificationCategory, channel: NotificationChannel, enabled: boolean): Promise<void>;
    getUserPreferences(userId: string): Promise<UserChannelPreference[]>;
}
declare class MemoryPreferencesStore implements IPreferencesStore {
    private prefs;
    isChannelEnabled(userId: string, category: NotificationCategory, channel: NotificationChannel): Promise<boolean>;
    setPreference(userId: string, category: NotificationCategory, channel: NotificationChannel, enabled: boolean): Promise<void>;
    getUserPreferences(userId: string): Promise<UserChannelPreference[]>;
}

interface InAppNotificationRecord {
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
interface IInAppStore {
    save(notification: InAppNotificationRecord): Promise<void>;
    getUserNotifications(userId: string, unreadOnly?: boolean): Promise<InAppNotificationRecord[]>;
    markAsRead(id: string, userId: string): Promise<boolean>;
    markAllAsRead(userId: string): Promise<number>;
}
declare class MemoryInAppStore implements IInAppStore {
    private notifications;
    save(notification: InAppNotificationRecord): Promise<void>;
    getUserNotifications(userId: string, unreadOnly?: boolean): Promise<InAppNotificationRecord[]>;
    markAsRead(id: string, userId: string): Promise<boolean>;
    markAllAsRead(userId: string): Promise<number>;
}
declare class PrismaInAppStore implements IInAppStore {
    private prisma;
    constructor(prisma: any);
    save(notification: InAppNotificationRecord): Promise<void>;
    getUserNotifications(userId: string, unreadOnly?: boolean): Promise<InAppNotificationRecord[]>;
    markAsRead(id: string, userId: string): Promise<boolean>;
    markAllAsRead(userId: string): Promise<number>;
}
declare class InAppChannelHandler implements INotificationChannelHandler {
    private store;
    readonly channelName = "in_app";
    private emitter;
    constructor(store?: IInAppStore);
    getStore(): IInAppStore;
    send(notification: NotificationPayload): Promise<ChannelDeliveryResult>;
    subscribe(userId: string, callback: (notification: InAppNotificationRecord) => void): () => void;
}

interface NotificationServiceOptions {
    preferencesStore?: IPreferencesStore;
    defaultChannels?: NotificationChannel[];
}
declare class NotificationService {
    private handlers;
    private preferencesStore;
    private defaultChannels;
    constructor(options?: NotificationServiceOptions);
    registerHandler(handler: INotificationChannelHandler): void;
    getInAppHandler(): InAppChannelHandler | undefined;
    getPreferencesStore(): IPreferencesStore;
    send(notification: NotificationPayload): Promise<{
        id: string;
        results: ChannelDeliveryResult[];
    }>;
}

interface WebhookChannelOptions {
    secret?: string;
    defaultWebhookUrl?: string;
    timeoutMs?: number;
}
declare class WebhookChannelHandler implements INotificationChannelHandler {
    readonly channelName = "webhook";
    private secret;
    private defaultWebhookUrl?;
    private timeoutMs;
    constructor(options?: WebhookChannelOptions);
    send(notification: NotificationPayload): Promise<ChannelDeliveryResult>;
}

type MailSenderFn = (options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}) => Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
}>;
declare class EmailNotificationHandler implements INotificationChannelHandler {
    private mailSender;
    readonly channelName = "email";
    constructor(mailSender: MailSenderFn);
    send(notification: NotificationPayload): Promise<ChannelDeliveryResult>;
}

declare const PRISMA_NOTIFICATION_SCHEMA_SNIPPET = "\nmodel Notification {\n  id        String    @id @default(uuid())\n  userId    String\n  category  String    @default(\"system\")\n  title     String\n  message   String\n  data      String?   // JSON object string\n  isRead    Boolean   @default(false)\n  readAt    DateTime?\n  createdAt DateTime  @default(now())\n\n  @@index([userId, isRead])\n}\n\nmodel NotificationPreference {\n  id        String   @id @default(uuid())\n  userId    String\n  category  String\n  channel   String\n  enabled   Boolean  @default(true)\n  createdAt DateTime @default(now())\n  updatedAt DateTime @updatedAt\n\n  @@unique([userId, category, channel])\n}\n";

declare function createNotificationRouter(service: NotificationService): Router;

export { type ChannelDeliveryResult, EmailNotificationHandler, type IInAppStore, type INotificationChannelHandler, type IPreferencesStore, InAppChannelHandler, type InAppNotificationRecord, type MailSenderFn, MemoryInAppStore, MemoryPreferencesStore, type NotificationCategory, type NotificationChannel, type NotificationPayload, NotificationService, type NotificationServiceOptions, PRISMA_NOTIFICATION_SCHEMA_SNIPPET, PrismaInAppStore, type UserChannelPreference, WebhookChannelHandler, type WebhookChannelOptions, createNotificationRouter };
