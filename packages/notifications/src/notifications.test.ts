import { describe, it, expect } from 'vitest';
import { NotificationService } from './dispatcher.js';
import { EmailNotificationHandler } from './channels/email.js';

describe('@core/notifications', () => {
  it('should deliver in-app notification by default and record it', async () => {
    const service = new NotificationService();

    const { id, results } = await service.send({
      userId: 'user_999',
      title: 'Order Shipped',
      message: 'Your order #456 has shipped!',
      category: 'transactional'
    });

    expect(id).toBeDefined();
    expect(results).toHaveLength(1);
    expect(results[0].channel).toBe('in_app');
    expect(results[0].success).toBe(true);

    const inAppStore = service.getInAppHandler()!.getStore();
    const list = await inAppStore.getUserNotifications('user_999');
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Order Shipped');
    expect(list[0].isRead).toBe(false);

    // Test mark as read
    await inAppStore.markAsRead(list[0].id, 'user_999');
    const unread = await inAppStore.getUserNotifications('user_999', true);
    expect(unread.length).toBe(0);
  });

  it('should respect user channel preferences when muting marketing channel', async () => {
    const service = new NotificationService({
      defaultChannels: ['in_app', 'email']
    });

    let emailSentCount = 0;
    service.registerHandler(
      new EmailNotificationHandler(async () => {
        emailSentCount++;
        return { success: true, messageId: 'em_1' };
      })
    );

    // Mute marketing emails for user_777
    await service.getPreferencesStore().setPreference('user_777', 'marketing', 'email', false);

    const result = await service.send({
      userId: 'user_777',
      category: 'marketing',
      title: 'Summer Sale',
      message: '50% off on all items!',
      recipientEmail: 'user777@example.com'
    });

    expect(emailSentCount).toBe(0);
    const emailResult = result.results.find((r) => r.channel === 'email');
    expect(emailResult?.success).toBe(false);
    expect(emailResult?.error).toContain('Muted');
  });
});
