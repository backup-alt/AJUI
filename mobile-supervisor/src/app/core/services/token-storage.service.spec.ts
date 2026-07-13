import { TestBed } from '@angular/core/testing';
import { Preferences } from '@capacitor/preferences';
import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  let service: TokenStorageService;
  let getSpy: jasmine.Spy;
  let setSpy: jasmine.Spy;
  let removeSpy: jasmine.Spy;

  beforeEach(() => {
    getSpy = spyOn(Preferences, 'get').and.returnValue(Promise.resolve({ value: null }));
    setSpy = spyOn(Preferences, 'set').and.returnValue(Promise.resolve());
    removeSpy = spyOn(Preferences, 'remove').and.returnValue(Promise.resolve());

    TestBed.configureTestingModule({});
    service = TestBed.inject(TokenStorageService);
  });

  describe('get', () => {
    it('returns stored value when present', async () => {
      getSpy.and.returnValue(Promise.resolve({ value: 'my-token' }));
      const result = await service.get('accessToken');
      expect(result).toBe('my-token');
    });

    it('returns null when value is undefined', async () => {
      getSpy.and.returnValue(Promise.resolve({ value: undefined }));
      const result = await service.get('accessToken');
      expect(result).toBeNull();
    });

    it('returns null on storage error', async () => {
      getSpy.and.returnValue(Promise.reject(new Error('storage error')));
      const result = await service.get('accessToken');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('calls Preferences.set with correct args', async () => {
      setSpy.and.returnValue(Promise.resolve());
      await service.set('refreshToken', 'abc123');
      expect(setSpy).toHaveBeenCalledWith({ key: 'refreshToken', value: 'abc123' });
    });

    it('does not throw on storage error', async () => {
      setSpy.and.returnValue(Promise.reject(new Error('storage error')));
      await expectAsync(service.set('key', 'value')).toBeResolved();
    });
  });

  describe('remove', () => {
    it('calls Preferences.remove with correct key', async () => {
      removeSpy.and.returnValue(Promise.resolve());
      await service.remove('accessToken');
      expect(removeSpy).toHaveBeenCalledWith({ key: 'accessToken' });
    });
  });

  describe('clearMany', () => {
    it('removes all keys', async () => {
      removeSpy.and.returnValue(Promise.resolve());
      await service.clearMany(['a', 'b', 'c']);
      expect(removeSpy).toHaveBeenCalledTimes(3);
    });
  });
});