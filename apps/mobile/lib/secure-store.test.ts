import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
  setItemAsync: vi.fn((key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: vi.fn((key: string) => {
    store.delete(key);
    return Promise.resolve();
  }),
}));

import { secureStoreAuthStorage } from './secure-store';

describe('secureStoreAuthStorage', () => {
  beforeEach(() => store.clear());

  it('AuthStorage 모양으로 값을 쓰고 읽고 지운다', async () => {
    await secureStoreAuthStorage.setItem('session', 'saved');
    await expect(secureStoreAuthStorage.getItem('session')).resolves.toBe('saved');
    await secureStoreAuthStorage.removeItem('session');
    await expect(secureStoreAuthStorage.getItem('session')).resolves.toBeNull();
  });
});
