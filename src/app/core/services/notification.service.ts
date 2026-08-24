import { Injectable, inject, signal } from '@angular/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { Preferences } from '@capacitor/preferences';
import { firstValueFrom } from 'rxjs';
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

  /** True once we've verified that PushNotifications.register() works on this device. */
  readonly fcmAvailable = signal<boolean>(true);

  /** Timestamp (ms) when the user last cleared all notifications. */
  private clearedAt = 0;

  /** Tracks whether we've already shown the push opt-in dialog this install. */
  private optInPromptShown = false;

  /** Tracks whether the user explicitly declined push (we'll never ask again). */
  private optedOut = false;

  /** Set when a periodic fetch is running to avoid duplicate timers. */
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  /** Native listeners must only be attached once per WebView lifetime. */
  private listenersRegistered = false;

  /** Completes the active registration attempt after the backend stores the token. */
  private registrationResultResolver: ((registered: boolean) => void) | null = null;

  /**
   * One-time check for whether Firebase is actually configured for this
   * app build. The Android build writes a small marker when a valid
   * `google-services.json` is present. If that
   * file is absent `PushNotifications.register()` will synchronously throw
   * `IllegalStateException("Default FirebaseApp is not initialized")` on
   * the bridge's main thread — Capacitor rethrows that as a RuntimeException
   * which Android treats as a fatal crash and force-closes the WebView.
   *
   * So before we ever call `register()` we probe for the file. The probe
   * result is cached for the lifetime of the app install.
   */
  private async probeFirebaseConfigured(): Promise<boolean> {
    if (!this.fcmAvailable()) return false;
    if (typeof fetch === 'undefined') return true;
    try {
      // Android's asset server is not consistent about HEAD requests. A small
      // GET reliably verifies the marker that the Android build writes.
      const res = await fetch('./push-configured.json', { method: 'GET', cache: 'no-store' });
      if (!res.ok) {
        console.warn('[Notification] native Firebase configuration missing — push disabled');
        this.fcmAvailable.set(false);
        return false;
      }
      return true;
    } catch (err) {
      // Do not permanently disable retries for a transient WebView/asset read.
      console.warn('[Notification] Firebase marker probe failed:', err);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    try {
      // 1. Ask for the system permission. This is safe even when FCM is
      //    unconfigured — it touches Android's permission framework only.
      const result = await this.raceWithTimeout(
        PushNotifications.requestPermissions(),
        8000,
        'PushNotifications.requestPermissions'
      );
      if (!result || result.receive !== 'granted') {
        this.pushEnabled.set(false);
        return false;
      }
      // 2. Probe Firebase BEFORE attempting register(). If google-services.json
      //    is missing the register() call crashes the WebView via Capacitor's
      //    RuntimeException rethrow (see probeFirebaseConfigured for details).
      const fcmOk = await this.probeFirebaseConfigured();
      if (!fcmOk) {
        console.warn('[Notification] FCM unavailable — device push cannot be enabled');
        this.pushEnabled.set(false);
        await this.persistPreference(false);
        return false;
      }

      // 3. Firebase is configured. register() is wrapped defensively so an
      //    unexpected failure here cannot crash the app.
      const registered = await this.register();
      this.pushEnabled.set(registered);
      await this.persistPreference(registered);
      return registered;
    } catch (err) {
      console.error('[Notification] permission request failed', err);
      this.pushEnabled.set(false);
      return false;
    }
  }

  async disable(): Promise<void> {
    try {
      const token = this.fcmToken();
      if (token) {
        await this.raceWithTimeout(
          firstValueFrom(this.api.post('/supervisor/device/unregister', { fcmToken: token })),
          5000,
          'device unregister'
        );
      }
    } catch (err) {
      console.warn('[Notification] device unregister failed', err);
    }
    // Only call the native unregister/listener calls if FCM is actually
    // available — otherwise they may hit the same Firebase-init crash.
    if (this.fcmAvailable()) {
      try {
        await this.raceWithTimeout(
          PushNotifications.removeAllListeners(),
          3000,
          'removeAllListeners'
        );
      } catch (err) {
        console.warn('[Notification] removeAllListeners failed', err);
      }
      try {
        await this.raceWithTimeout(
          PushNotifications.unregister(),
          3000,
          'unregister'
        );
      } catch (err) {
        console.warn('[Notification] unregister failed', err);
      }
    }
    this.fcmToken.set(null);
    this.pushEnabled.set(false);
    await this.persistPreference(false);
  }

  async initFromStorage(): Promise<void> {
    const { value } = await Preferences.get({ key: 'pushEnabled' });
    this.pushEnabled.set(value === 'true');
    const { value: optedOut } = await Preferences.get({ key: 'pushOptedOut' });
    this.optedOut = optedOut === 'true';
    await this.loadClearedAt();
    await this.loadFromStorage();
  }

  /**
   * Show the system push-permission prompt exactly once per install (unless
   * the user already opted in or explicitly opted out). Returns true if push
   * became available, false otherwise.
   *
   * Safe to call multiple times — we self-debounce via optInPromptShown.
   *
   * We deliberately do NOT call this automatically from ngOnInit. The system
   * permission dialog steals focus from the app and on some devices a Firebase
   * crash during register() can force-close the WebView. Pushing must be an
   * explicit, user-initiated action (via the profile toggle).
   */
  async ensurePushPermissionOnce(): Promise<boolean> {
    if (this.pushEnabled() || this.optedOut || this.optInPromptShown) return false;
    this.optInPromptShown = true;
    return this.requestPermission();
  }

  /**
   * Restore real device delivery after login. Enabled users are registered
   * again on every app launch so refreshed FCM tokens reach the backend.
   * New installs receive the operating-system permission prompt once.
   */
  async initializeDevicePush(): Promise<boolean> {
    if (this.pushEnabled()) return this.requestPermission();
    return this.ensurePushPermissionOnce();
  }

  /** Mark the user as opted out so we never ask again. */
  async markOptedOut(): Promise<void> {
    this.optedOut = true;
    await Preferences.set({ key: 'pushOptedOut', value: 'true' });
  }

  /**
   * Register for push notifications. Only called after the FCM availability
   * probe has succeeded, so this is safe on devices where Firebase is
   * actually wired up. Every step is still wrapped defensively — a stuck
   * Firebase init can never block the Angular zone.
   */
  private async register(): Promise<boolean> {
    // Add listeners before register(). Android can emit the token immediately,
    // so attaching them afterwards intermittently loses device registration.
    if (!this.listenersRegistered) {
      await Promise.all([
      this.safeAddListener('registration', async (token: Token) => {
        if (!token?.value) {
          this.registrationResultResolver?.(false);
          return;
        }
        this.fcmToken.set(token.value);
        try {
          const deviceId = await this.getDeviceId();
          await this.raceWithTimeout(
            firstValueFrom(
              this.api.post('/supervisor/device/register', {
                fcmToken: token.value,
                platform: this.getPlatform(),
                deviceId,
                appVersion: environment.version,
              })
            ),
            8000,
            'device register'
          );
          this.pushEnabled.set(true);
          await this.persistPreference(true);
          this.registrationResultResolver?.(true);
        } catch (err) {
          console.warn('[Notification] failed to register device with backend:', err);
          this.registrationResultResolver?.(false);
        }
      }),

      this.safeAddListener('registrationError', (err) => {
        console.warn('[Notification] FCM registration error:', err);
        this.registrationResultResolver?.(false);
      }),

      this.safeAddListener('pushNotificationReceived', (notification) => {
        try {
          this.addInApp({
            id: notification.id || String(Date.now()),
            title: notification.title || 'Notification',
            body: notification.body || '',
            data: notification.data,
            receivedAt: Date.now(),
            read: false,
          });
        } catch (err) {
          console.warn('[Notification] failed to add in-app notification:', err);
        }
      }),

      this.safeAddListener('pushNotificationActionPerformed', (action) => {
        try {
          const data = action.notification?.data;
          if (data?.['route']) {
            window.dispatchEvent(
              new CustomEvent('agb:push-navigate', { detail: data['route'] })
            );
          }
        } catch (err) {
          console.warn('[Notification] action handler failed:', err);
        }
      }),
      ]);
      this.listenersRegistered = true;
    }

    const tokenRegistered = new Promise<boolean>((resolve) => {
      this.registrationResultResolver = resolve;
    });

    try {
      await this.raceWithTimeout(
        PushNotifications.createChannel({
          id: 'agb_updates',
          name: 'AGB updates',
          description: 'Project approvals and material updates',
          importance: 5,
          visibility: 1,
          vibration: true,
        }),
        3000,
        'PushNotifications.createChannel'
      );
    } catch (err) {
      console.warn('[Notification] notification channel setup failed:', err);
    }

    try {
      await this.raceWithTimeout(
        PushNotifications.register(),
        5000,
        'PushNotifications.register'
      );
    } catch (err) {
      console.warn('[Notification] register failed (push disabled):', err);
      this.fcmAvailable.set(false);
      this.pushEnabled.set(false);
      await this.persistPreference(false);
      this.registrationResultResolver = null;
      return false;
    }

    let registered = false;
    try {
      registered = await this.raceWithTimeout(
        tokenRegistered,
        12_000,
        'FCM token backend registration'
      );
    } catch (err) {
      console.warn('[Notification] token registration did not complete:', err);
    } finally {
      this.registrationResultResolver = null;
    }

    // Drain any already-delivered notifications into the in-app list.
    try {
      await this.raceWithTimeout(
        PushNotifications.getDeliveredNotifications(),
        4000,
        'getDeliveredNotifications'
      ).then((delivered) => {
        for (const n of (delivered?.notifications || []) as any[]) {
          this.addInApp({
            id: n.id || String(Date.now()),
            title: n.title || 'Notification',
            body: n.body || '',
            receivedAt: Date.now(),
            read: false,
          });
        }
      }).catch((err) => {
        console.warn('[Notification] getDeliveredNotifications failed:', err);
      });
    } catch (err) {
      console.warn('[Notification] getDeliveredNotifications outer failure:', err);
    }
    return registered;
  }

  /**
   * Wraps `PushNotifications.addListener` so a single failure (or a
   * missing native side) does not propagate. Returns silently.
   */
  private async safeAddListener(
    eventName: 'registration' | 'registrationError' | 'pushNotificationReceived' | 'pushNotificationActionPerformed',
    handler: (payload: any) => void | Promise<void>
  ): Promise<void> {
    try {
      let registration: Promise<unknown>;
      switch (eventName) {
        case 'registration':
          registration = PushNotifications.addListener('registration', handler as any);
          break;
        case 'registrationError':
          registration = PushNotifications.addListener('registrationError', handler as any);
          break;
        case 'pushNotificationReceived':
          registration = PushNotifications.addListener('pushNotificationReceived', handler as any);
          break;
        case 'pushNotificationActionPerformed':
        default:
          registration = PushNotifications.addListener(
            'pushNotificationActionPerformed',
            handler as any
          );
          break;
      }
      await this.raceWithTimeout(registration, 3000, `addListener(${eventName})`);
    } catch (err) {
      console.warn(`[Notification] addListener(${eventName}) failed:`, err);
    }
  }

  /**
   * Race a promise against a timeout so a stuck native call (e.g.
   * Firebase init hanging on a device without Play Services) can never
   * block the Angular zone forever. Rejects on timeout or on the
   * underlying promise's rejection.
   */
  private raceWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      p.then(
        (value) => { clearTimeout(timer); resolve(value); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  }

  private addInApp(n: InAppNotification): void {
    if (this.isMaterialApprovalNotification(n)) return;
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
        const visible = list.filter((n) => !this.isMaterialApprovalNotification(n));
        const filtered = this.clearedAt > 0
          ? visible.filter((n) => n.receivedAt > this.clearedAt)
          : visible;
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
      })).filter((n) => !this.isMaterialApprovalNotification(n));
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

  /**
   * Start polling the backend for new notifications every `intervalMs`
   * milliseconds. Idempotent — calling this multiple times is a no-op.
   * Stops automatically on logout (cleared via clearPolling()).
   */
  startPolling(intervalMs: number = 30_000): void {
    if (this.pollTimer) return;
    // Fire one fetch immediately, then on the interval.
    void this.fetchFromBackend();
    this.pollTimer = setInterval(() => {
      void this.fetchFromBackend();
    }, intervalMs);
  }

  /** Stop the periodic fetch (e.g. on logout). */
  stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private recalcUnread(): void {
    this.unreadCount.set(this.notifications().filter((n) => !n.read).length);
  }

  private isMaterialApprovalNotification(notification: InAppNotification): boolean {
    const type = String(notification.data?.['type'] || '').toLowerCase();
    const status = String(notification.data?.['status'] || '').toLowerCase();
    const text = `${notification.title} ${notification.body}`.toLowerCase();
    const relatesToMaterial = type.includes('material') || text.includes('material approval');
    const isApprovalResult = ['approved', 'rejected'].includes(status) ||
      text.includes(' approved') || text.includes(' rejected');
    return relatesToMaterial && isApprovalResult;
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
