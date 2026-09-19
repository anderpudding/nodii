import { createClient, type SupabaseClient, type Session } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * supabase-js 세션 저장소 인터페이스.
 * 데스크톱은 plugin-store 어댑터, 모바일(v2)은 SecureStore 어댑터를 넣는다.
 */
export interface AuthStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface NodiiClientOptions {
  url: string;
  publishableKey: string;
  storage: AuthStorage;
  fetch?: typeof fetch;
}

export const AUTH_STORAGE_KEY = 'nodii.auth';

export type NodiiClient = SupabaseClient<Database>;
const clientStorage = new WeakMap<NodiiClient, AuthStorage>();

/** SYNC-04: 토큰 갱신을 기다리지 않고 로컬 읽기에 사용할 계정만 복원한다. 권한은 서버 RLS가 검증한다. */
export async function readStoredSession(client: NodiiClient): Promise<Session | null> {
  const value = await clientStorage.get(client)?.getItem(AUTH_STORAGE_KEY);
  if (!value) return null;
  const session: unknown = JSON.parse(value);
  if (
    !session ||
    typeof session !== 'object' ||
    !('access_token' in session) ||
    typeof session.access_token !== 'string' ||
    !('refresh_token' in session) ||
    typeof session.refresh_token !== 'string' ||
    !('user' in session) ||
    !session.user ||
    typeof session.user !== 'object' ||
    !('id' in session.user) ||
    typeof session.user.id !== 'string'
  )
    return null;
  return session as Session;
}

export function createNodiiClient({
  url,
  publishableKey,
  storage,
  fetch: customFetch,
}: NodiiClientOptions): NodiiClient {
  const client = createClient<Database>(url, publishableKey, {
    global: { fetch: customFetch },
    auth: {
      storage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      // 이메일 OTP만 쓰므로 URL에서 세션을 읽을 일이 없다 (설계서 §6.5)
      detectSessionInUrl: false,
    },
  });
  clientStorage.set(client, storage);
  return client;
}
