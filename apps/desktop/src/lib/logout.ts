import { signOut, type NodiiClient } from '@nodii/api';
import type { QueryClient } from '@tanstack/react-query';
import { clearSessionStorage } from './supabase';

/** AUTH-03: 6단계의 persister 삭제도 이 정리 흐름에 추가한다. */
export async function logout(
  client: NodiiClient,
  queryClient: QueryClient,
  clearStorage = clearSessionStorage,
): Promise<void> {
  await signOut(client);
  await queryClient.cancelQueries();
  queryClient.clear();
  await clearStorage();
}
