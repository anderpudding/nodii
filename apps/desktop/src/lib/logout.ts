import { normalizeAuthError, signOut, type NodiiClient } from '@nodii/api';
import type { QueryClient } from '@tanstack/react-query';
import { clearSessionStorage } from './supabase';
import { clearPersistedCache } from './query-persister';

/** AUTH-03: 오프라인에서도 로컬 정보를 지우고 서버 로그아웃 여부를 호출자에게 알린다. */
export async function logout(
  client: NodiiClient,
  queryClient: QueryClient,
  clearStorage = clearSessionStorage,
  accountDeleted = false,
): Promise<{ localOnly: boolean }> {
  let localOnly = false;
  try {
    await signOut(client);
  } catch (error) {
    if (!accountDeleted && normalizeAuthError(error).code !== 'network') throw error;
    localOnly = true;
  }
  await clearPersistedCache(queryClient);
  await queryClient.cancelQueries();
  queryClient.clear();
  await clearStorage();
  await client.auth.stopAutoRefresh();
  window.dispatchEvent(new Event('nodii:signed-out'));
  return { localOnly };
}
