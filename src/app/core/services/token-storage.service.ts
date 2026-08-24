import { Injectable, inject, InjectionToken } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

export const StorageService = new InjectionToken<{
  get(opts: { key: string }): Promise<{ value: string | null }>;
  set(opts: { key: string; value: string }): Promise<void>;
  remove(opts: { key: string }): Promise<void>;
}>('StorageService', {
  factory: () => Preferences,
});

@Injectable({ providedIn: 'root' })
export class TokenStorageService {
  private storage = inject(StorageService);

  async get(key: string): Promise<string | null> {
    try {
      const { value } = await this.storage.get({ key });
      return value || null;
    } catch {
      return null;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      await this.storage.set({ key, value });
    } catch {
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.storage.remove({ key });
    } catch {
    }
  }

  async clearMany(keys: string[]): Promise<void> {
    await Promise.all(keys.map((k) => this.remove(k)));
  }
}