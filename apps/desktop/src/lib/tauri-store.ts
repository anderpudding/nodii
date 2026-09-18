import type { AuthStorage } from '@nodii/api';
import { load, type Store } from '@tauri-apps/plugin-store';

let sessionStore: Promise<Store> | null = null;

/**
 * 세션 저장소. App Sandbox에서는 ~/Library/Containers/com.sungjunlee.Nodii/ 아래에 저장된다.
 * (NFR-07: v2에서 macOS 키체인으로 이전)
 */
export function getSessionStore(): Promise<Store> {
  sessionStore ??= load('session.json', { autoSave: true });
  return sessionStore;
}

/** AUTH-02: 앱 종료 직전에도 세션이 보존되도록 디스크 저장까지 기다린다. */
export const tauriAuthStorage: AuthStorage = {
  async getItem(key) {
    const store = await getSessionStore();
    return (await store.get<string>(key)) ?? null;
  },
  async setItem(key, value) {
    const store = await getSessionStore();
    await store.set(key, value);
    await store.save();
  },
  async removeItem(key) {
    const store = await getSessionStore();
    await store.delete(key);
    await store.save();
  },
};
