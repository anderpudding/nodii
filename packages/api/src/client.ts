import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
}

export const AUTH_STORAGE_KEY = 'nodii.auth';

export type NodiiClient = SupabaseClient<Database>;

export function createNodiiClient({
  url,
  publishableKey,
  storage,
}: NodiiClientOptions): NodiiClient {
  return createClient<Database>(url, publishableKey, {
    auth: {
      storage,
      storageKey: AUTH_STORAGE_KEY,
      persistSession: true,
      autoRefreshToken: true,
      // 이메일 OTP만 쓰므로 URL에서 세션을 읽을 일이 없다 (설계서 §6.5)
      detectSessionInUrl: false,
    },
  });
}
