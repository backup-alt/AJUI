import { Injectable, inject } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

/**
 * Abstraction over persistent storage. The default implementation uses
 * @capacitor/preferences which on iOS uses the Keychain (encrypted at rest)
 * and on Android uses SharedPreferences (unencrypted by default).
 *
 * On Android you can swap this implementation for a secure-store plugin
 * (e.g. @capacitor-community/secure-storage) without touching call sites.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  async get(key: string): Promise<string | null> {
    try {
      const { value } = await Preferences.get({ key });
      return value || null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await Preferences.set({ key, value });
    } catch {
      // Storage failures are non-fatal — the user is still authenticated in memory.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await Preferences.remove({ key });
    } catch {
      // ignore
    }
  }

  async clearMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.remove(k)));
  }
}
