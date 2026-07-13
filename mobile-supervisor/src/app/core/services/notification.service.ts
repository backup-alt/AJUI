import { Injectable, inject } from '@angular/core';
import { PushNotifications, Token, NotificationPermissionsRequest } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { Observable, from, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private token: string | null = null;

  async requestPermission(): Promise<boolean> {
    try {
      const permissions: NotificationPermissionsRequest = {
        granted: false,
      };

      const result = await PushNotifications.requestPermissions();
      return result.receive === 'granted';
    } catch (error) {
      console.error('Push permission error:', error);
      return false;
    }
  }

  async register(): Promise<void> {
    try {
      await PushNotifications.register();

      PushNotifications.addListener('registration', async (token: Token) => {
        this.token = token.value;
        await this.registerDeviceToken(token.value);
      });

      PushNotifications.addListener('registrationError', (error) => {
        console.error('Push registration error:', error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        this.handleNotification(notification);
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        this.handleNotificationAction(notification);
      });
    } catch (error) {
      console.error('Push registration error:', error);
    }
  }

  private async registerDeviceToken(fcmToken: string): Promise<void> {
    try {
      const platform = await this.getPlatform();
      const deviceId = await this.getDeviceId();

      await this.api.post('/mobile/supervisor/device/register', {
        fcmToken,
        platform,
        deviceId,
        appVersion: environment.version,
      });
    } catch (error) {
      console.error('Device token registration error:', error);
    }
  }

  private async getPlatform(): Promise<string> {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    return isIOS ? 'ios' : 'android';
  }

  private async getDeviceId(): Promise<string> {
    const { value } = await Preferences.get({ key: 'deviceId' });
    if (value) return value;

    const deviceId = this.generateUUID();
    await Preferences.set({ key: 'deviceId', value: deviceId });
    return deviceId;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private handleNotification(notification: { title?: string; body?: string; data?: Record<string, string> }): void {
    console.log('Push notification received:', notification);
    // TODO: Show in-app notification banner
  }

  private handleNotificationAction(notification: { notification?: { data?: Record<string, string> }; actionId?: string }): void {
    console.log('Push notification action:', notification);
    // TODO: Navigate based on notification data
  }

  async unregister(): Promise<void> {
    try {
      if (this.token) {
        await this.api.post('/mobile/supervisor/device/unregister', {
          fcmToken: this.token,
        });
      }
      await PushNotifications.unregister();
    } catch (error) {
      console.error('Push unregister error:', error);
    }
  }

  async getRegisteredDevices(): Observable<{ devices: unknown[] }> {
    return this.api.get<{ devices: unknown[] }>('/mobile/supervisor/devices');
  }

  localNotification(notification: PushNotification): void {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.body,
        icon: '/assets/icon/icon.png',
      });
    }
  }
}