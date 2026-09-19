import type { AuthStorage } from '@nodii/api';
import { isTauri } from '@tauri-apps/api/core';
import { load, type Store } from '@tauri-apps/plugin-store';

let storePromise: Promise<Store> | undefined;
function getStore() {
  storePromise ??= load('query-cache.json', { autoSave: false });
  return storePromise;
}
/** SYNC-04: 인증 파일과 분리하고 디스크 저장이 끝난 뒤 완료를 알린다. */
export const queryStorage: AuthStorage = {
  async getItem(key) {
    return isTauri()
      ? ((await (await getStore()).get<string>(key)) ?? null)
      : localStorage.getItem(key);
  },
  async setItem(key, value) {
    if (!isTauri()) {
      localStorage.setItem(key, value);
      return;
    }
    const store = await getStore();
    await store.set(key, value);
    await store.save();
  },
  async removeItem(key) {
    if (!isTauri()) {
      localStorage.removeItem(key);
      return;
    }
    const store = await getStore();
    await store.delete(key);
    await store.save();
  },
};
