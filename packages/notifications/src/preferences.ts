import { NotificationChannel, NotificationCategory } from './types.js';

export interface UserChannelPreference {
  userId: string;
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

export interface IPreferencesStore {
  isChannelEnabled(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel
  ): Promise<boolean>;
  setPreference(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<void>;
  getUserPreferences(userId: string): Promise<UserChannelPreference[]>;
}

export class MemoryPreferencesStore implements IPreferencesStore {
  // Key format: `${userId}:${category}:${channel}`
  private prefs: Map<string, boolean> = new Map();

  async isChannelEnabled(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel
  ): Promise<boolean> {
    // Critical security alerts cannot be muted
    if (category.toLowerCase() === 'security') {
      return true;
    }

    const key = `${userId}:${category}:${channel}`;
    const value = this.prefs.get(key);
    // Enabled by default unless explicitly disabled
    return value !== undefined ? value : true;
  }

  async setPreference(
    userId: string,
    category: NotificationCategory,
    channel: NotificationChannel,
    enabled: boolean
  ): Promise<void> {
    const key = `${userId}:${category}:${channel}`;
    this.prefs.set(key, enabled);
  }

  async getUserPreferences(userId: string): Promise<UserChannelPreference[]> {
    const results: UserChannelPreference[] = [];
    for (const [key, enabled] of this.prefs.entries()) {
      if (key.startsWith(`${userId}:`)) {
        const [, category, channel] = key.split(':');
        results.push({ userId, category, channel, enabled });
      }
    }
    return results;
  }
}
