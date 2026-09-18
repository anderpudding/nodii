import { createNodiiClient, type AuthStorage } from '@nodii/api';

export const baseUrl = 'http://127.0.0.1:54321';
export const testUser = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'user@example.com',
  aud: 'authenticated',
  role: 'authenticated',
  app_metadata: {},
  user_metadata: {},
  created_at: '2026-09-17T00:00:00Z',
};
export const sessionResponse = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  user: testUser,
};
export function createTestClient(storage?: AuthStorage) {
  const values = new Map<string, string>();
  return createNodiiClient({
    url: baseUrl,
    publishableKey: 'test-publishable-key',
    storage: storage ?? {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    },
  });
}
