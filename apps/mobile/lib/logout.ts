import {
  AUTH_STORAGE_KEY,
  normalizeAuthError,
  signOut,
  type NodiiClient,
  type AuthStorage,
} from '@nodii/api';
import type { QueryClient } from '@tanstack/react-query';
import { secureStoreAuthStorage } from './secure-store';

/** AUTH-03: 서버 해제 후 캐시와 인증 키를 지우며 네트워크 오류도 로컬 로그아웃을 허용한다. */
export async function logout(
  client: NodiiClient,
  query: QueryClient,
  storage: AuthStorage = secureStoreAuthStorage,
): Promise<{ localOnly: boolean }> {
  let localOnly = false;
  try {
    await signOut(client);
  } catch (error) {
    if (normalizeAuthError(error).code !== 'network') throw error;
    localOnly = true;
  }
  await query.cancelQueries();
  query.clear();
  for (const key of [
    AUTH_STORAGE_KEY,
    `${AUTH_STORAGE_KEY}-code-verifier`,
    `${AUTH_STORAGE_KEY}-user`,
  ]) {
    await storage.removeItem(key);
  }
  await client.auth.stopAutoRefresh();
  return { localOnly };
}
