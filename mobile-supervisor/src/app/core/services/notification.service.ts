import { Injectable, inject, signal } from '@angular/core';
import { PushNotifications, Token, DeliveredNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { ApiService } from './api.service';
import { SupervisorService } from './supervisor.service';
import { environment } from '../../../environments/environment';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  receivedAt: number;
  read: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private supervisor = inject(SupervisorService);

  readonly pushEnabled = signal<boolean>(false);
  readonly fcmToken = signal<string | null>(null);
  readonly notifications = signal<InAppNotification[]>([]);
  readonly unreadCount = signal<number>(0);

  /** Timestamp (ms) when the user last cleared all notifications. */
  private clearedAt = 0;

  async requestPermission(): Promise<boolean> {
    try {
      const result = await PushNotifications.requestPermissions();
      if (result.receive !== 'granted') {
        this.pushEnabled.set(false);
        return false;
      }
      this.pushEnabled.set(true);
      await this.register();
      await this.persistPreference(true);
      return true;
    } catch (err) {
      console.error('[Notification] permission request failed', err);
      return false;
    }
  }

  async disable(): Promise<void> {
    try {
      const token = this.fcmToken();
      if (token) {
        await this.api.post('/supervisor/device/unregister', { fcmToken: token });
      }
      await PushNotifications.removeAllListeners();
      await PushNotifications.unregister();
      this.fcmToken.set(null);
      this.pushEnabled.set(false);
      await this.persistPreference(false);
    } catch (err) {
      console.error('[Notification] disable failed', err);
    }
  }

  async initFromStorage(): Promise<void> {
    const { value } = await Preferences.get({ key: 'pushEnabled' });
    this.pushEnabled.set(value === 'true');
    await this.loadClearedAt();
    await this.loadFromStorage();
  }

  private async register(): Promise<void> {
    await PushNotifications.register();

    await PushNotifications.addListener('registration', async (token: Token) => {
      this.fcmToken.set(token.value);
      try {
        const deviceId = await this.getDeviceId();
        await this.api.post('/supervisor/device/register', {
          fcmToken: token.value,
          platform: this.getPlatform(),
          deviceId,
          appVersion: environment.version,
        });
      } catch (err) {
        console.error('[Notification] failed to register device with backend', err);
      }
    });

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[Notification] FCM registration error', err);
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification) => {
        this.addInApp({
          id: notification.id || String(Date.now()),
          title: notification.title || 'Notification',
          body: notification.body || '',
          data: notification.data,
          receivedAt: Date.now(),
          read: false,
        });
      }
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action) => {
        const data = action.notification?.data;
        if (data?.['route']) {
          window.dispatchEvent(
            new CustomEvent('agb:push-navigate', { detail: data['route'] })
          );
        }
      }
    );

    await PushNotifications.getDeliveredNotifications().then((delivered: DeliveredNotifications) => {
      for (const n of delivered.notifications) {
        this.addInApp({
          id: n.id || String(Date.now()),
          title: n.title || 'Notification',
          body: n.body || '',
          receivedAt: Date.now(),
          read: false,
        });
      }
    });
  }

  private addInApp(n: InAppNotification): void {
    // Skip if this notification was received before the user cleared all
    if (this.clearedAt > 0 && n.receivedAt <= this.clearedAt) return;

    const existing = this.notifications();
    // Deduplicate by ID
    if (existing.some((e) => e.id === n.id)) return;

    this.notifications.update((list) => [n, ...list].slice(0, 50));
    this.unreadCount.update((c) => c + (n.read ? 0 : 1));
    this.persistNotifications();
  }

  notify(title: string, body: string, data?: Record<string, string>): void {
    this.addInApp({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title,
      body,
      data,
      receivedAt: Date.now(),
      read: false,
    });
  }

  /** Mark a single notification as read. */
  markRead(notifId: string): void {
    let changed = false;
    this.notifications.update((list) =>
      list.map((n) => {
        if (n.id === notifId && !n.read) {
          changed = true;
          return { ...n, read: true };
        }
        return n;
      })
    );
    if (changed) {
      this.recalcUnread();
      this.persistNotifications();
    }
  }

  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    this.unreadCount.set(0);
    this.persistNotifications();
  }

  /** Clear all notifications and persist the clearedAt timestamp. */
  async clear(): Promise<void> {
    this.clearedAt = Date.now();
    this.notifications.set([]);
    this.unreadCount.set(0);
    await this.persistClearedAt();
    await this.persistNotifications();
  }

  /** Clear a single notification. */
  async clearSingle(notifId: string): Promise<void> {
    this.notifications.update((list) => list.filter((n) => n.id !== notifId));
    this.recalcUnread();
    await this.persistNotifications();
  }

  async loadFromStorage(): Promise<void> {
    const { value } = await Preferences.get({ key: 'notifications' });
    if (value) {
      try {
        const list = JSON.parse(value) as InAppNotification[];
        // Filter out notifications that were received before the last clear
        const filtered = this.clearedAt > 0
          ? list.filter((n) => n.receivedAt > this.clearedAt)
          : list;
        this.notifications.set(filtered);
        this.unreadCount.set(filtered.filter((n) => !n.read).length);
      } catch { /* ignore */ }
    }
  }

  async fetchFromBackend(): Promise<void> {
    try {
      const res = await this.supervisor.getRecentNotifications(30).toPromise();
      const backendNotifs = (res?.notifications || []).map((n) => ({
        id: `backend-${n.id}`,
        title: n.title,
        body: n.body,
        data: { type: n.type, status: n.status },
        receivedAt: n.receivedAt,
        read: false,
      }));
      if (backendNotifs.length === 0) return;

      const existing = this.notifications();
      const existingIds = new Set(existing.map((n) => n.id));

      // Filter: skip notifications received before the last clear, and skip duplicates
      const newNotifs = backendNotifs.filter((n) => {
        if (existingIds.has(n.id)) return false;
        if (this.clearedAt > 0 && n.receivedAt <= this.clearedAt) return false;
        return true;
      });

      if (newNotifs.length > 0) {
        // Preserve read state from existing notifications
        const readMap = new Map(existing.map((n) => [n.id, n.read]));
        const withReadState = newNotifs.map((n) => ({
          ...n,
          read: readMap.get(n.id) ?? false,
        }));

        this.notifications.update((list) => [...withReadState, ...list].slice(0, 50));
        this.recalcUnread();
        this.persistNotifications();
      }
    } catch (err) {
      console.error('[Notification] failed to fetch from backend', err);
    }
  }

  private recalcUnread(): void {
    this.unreadCount.set(this.notifications().filter((n) => !n.read).length);
  }

  private async persistNotifications(): Promise<void> {
    await Preferences.set({
      key: 'notifications',
      value: JSON.stringify(this.notifications()),
    });
  }

  private async persistPreference(enabled: boolean): Promise<void> {
    await Preferences.set({ key: 'pushEnabled', value: enabled ? 'true' : 'false' });
  }

  private async loadClearedAt(): Promise<void> {
    const { value } = await Preferences.get({ key: 'notificationsClearedAt' });
    this.clearedAt = value ? Number(value) || 0 : 0;
  }

  private async persistClearedAt(): Promise<void> {
    await Preferences.set({
      key: 'notificationsClearedAt',
      value: String(this.clearedAt),
    });
  }

  private getPlatform(): 'ios' | 'android' {
    const ua = navigator.userAgent;
    return /iPad|iPhone|iPod/.test(ua) ? 'ios' : 'android';
  }

  private async getDeviceId(): Promise<string> {
    const { value } = await Preferences.get({ key: 'deviceId' });
    if (value) return value;
    const id = this.generateUUID();
    await Preferences.set({ key: 'deviceId', value: id });
    return id;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
