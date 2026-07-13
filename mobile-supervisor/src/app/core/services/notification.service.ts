import { Injectable, inject, signal } from '@angular/core';
import { PushNotifications, Token, DeliveredNotifications } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { ApiService } from './api.service';
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

  readonly pushEnabled = signal<boolean>(false);
  readonly fcmToken = signal<string | null>(null);
  readonly notifications = signal<InAppNotification[]>([]);
  readonly unreadCount = signal<number>(0);

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
        await this.api.post('/mobile/supervisor/device/unregister', { fcmToken: token });
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
  }

  private async register(): Promise<void> {
    await PushNotifications.register();

    await PushNotifications.addListener('registration', async (token: Token) => {
      this.fcmToken.set(token.value);
      try {
        const deviceId = await this.getDeviceId();
        await this.api.post('/mobile/supervisor/device/register', {
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
          // Navigation is the caller's responsibility. We expose the route via the data.
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
    this.notifications.update((list) => [n, ...list].slice(0, 50));
    this.unreadCount.update((c) => c + 1);
  }

  markAllRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    this.unreadCount.set(0);
  }

  clear(): void {
    this.notifications.set([]);
    this.unreadCount.set(0);
  }

  private async persistPreference(enabled: boolean): Promise<void> {
    await Preferences.set({ key: 'pushEnabled', value: enabled ? 'true' : 'false' });
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
