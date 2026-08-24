import { TestBed } from '@angular/core/testing';
import { TokenStorageService, StorageService } from './token-storage.service';

const mockStorage = new Map<string, string>();

const mockPreferences = {
  get: jasmine.createSpy('get').and.callFake((opts: { key: string }) =>
    Promise.resolve({ value: mockStorage.get(opts.key) || null })
  ),
  set: jasmine.createSpy('set').and.callFake((opts: { key: string; value: string }) => {
    mockStorage.set(opts.key, opts.value);
    return Promise.resolve();
  }),
  remove: jasmine.createSpy('remove').and.callFake((opts: { key: string }) => {
    mockStorage.delete(opts.key);
    return Promise.resolve();
  }),
};

describe('TokenStorageService', () => {
  let service: TokenStorageService;

  beforeEach(() => {
    mockStorage.clear();
    mockPreferences.get.calls.reset();
    mockPreferences.set.calls.reset();
    mockPreferences.remove.calls.reset();

    TestBed.configureTestingModule({});
    TestBed.overrideProvider(StorageService, { useValue: mockPreferences });
    service = TestBed.inject(TokenStorageService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('get', () => {
    it('returns null when key is absent', async () => {
      const result = await service.get('nonexistent');
      expect(result).toBeNull();
      expect(mockPreferences.get).toHaveBeenCalledWith({ key: 'nonexistent' });
    });

    it('returns null on storage rejection', async () => {
      mockPreferences.get.and.returnValue(Promise.reject(new Error('storage error')));
      const result = await service.get('accessToken');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('calls storage.set with correct args', async () => {
      await service.set('refreshToken', 'abc123');
      expect(mockPreferences.set).toHaveBeenCalledWith({ key: 'refreshToken', value: 'abc123' });
    });

    it('does not throw on storage rejection', async () => {
      mockPreferences.set.and.returnValue(Promise.reject(new Error('storage error')));
      await expectAsync(service.set('key', 'value')).toBeResolved();
    });
  });

  describe('remove', () => {
    it('calls storage.remove with correct key', async () => {
      await service.remove('accessToken');
      expect(mockPreferences.remove).toHaveBeenCalledWith({ key: 'accessToken' });
    });
  });

  describe('clearMany', () => {
    it('calls storage.remove for each key', async () => {
      await service.clearMany(['a', 'b', 'c']);
      expect(mockPreferences.remove).toHaveBeenCalledTimes(3);
    });
  });
});