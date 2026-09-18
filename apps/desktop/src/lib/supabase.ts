import { createNodiiClient, AUTH_STORAGE_KEY, type AuthStorage } from '@nodii/api';
import { isTauri } from '@tauri-apps/api/core';
import { env } from './env';
import { tauriAuthStorage } from './tauri-store';

const browserAuthStorage: AuthStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};
export const authStorage = isTauri() ? tauriAuthStorage : browserAuthStorage;
export const supabase = env.isSupabaseConfigured
  ? createNodiiClient({
      url: env.supabaseUrl,
      publishableKey: env.supabasePublishableKey,
      storage: authStorage,
    })
  : null;

/** AUTH-03: 다른 기기 설정은 남기고 인증 관련 키만 정리한다. */
export async function clearSessionStorage(storage: AuthStorage = authStorage): Promise<void> {
  for (const key of [
    AUTH_STORAGE_KEY,
    `${AUTH_STORAGE_KEY}-code-verifier`,
    `${AUTH_STORAGE_KEY}-user`,
  ]) {
    await storage.removeItem(key);
  }
}
