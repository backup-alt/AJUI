export const mockStorage = new Map<string, string>();

export const Preferences = {
  get: (opts: { key: string }) =>
    Promise.resolve({ value: mockStorage.get(opts.key) || null }),
  set: (opts: { key: string; value: string }) => {
    mockStorage.set(opts.key, opts.value);
    return Promise.resolve();
  },
  remove: (opts: { key: string }) => {
    mockStorage.delete(opts.key);
    return Promise.resolve();
  },
  clear: () => {
    mockStorage.clear();
    return Promise.resolve();
  },
};

export function resetPreferencesMock(): void {
  mockStorage.clear();
}