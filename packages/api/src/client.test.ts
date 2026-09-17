import { describe, expect, it } from 'vitest';
import { createNodiiClient, type AuthStorage } from './client';

function memoryStorage(): AuthStorage {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

describe('createNodiiClient', () => {
  it('주입한 저장소로 클라이언트를 만든다', async () => {
    const client = createNodiiClient({
      url: 'http://127.0.0.1:54321',
      publishableKey: 'test-key',
      storage: memoryStorage(),
    });

    const { data, error } = await client.auth.getSession();
    expect(error).toBeNull();
    expect(data.session).toBeNull();
  });
});
