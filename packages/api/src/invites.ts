import type { NodiiClient } from './client';

/** SOC-05: 다른 계정의 토큰은 RLS가 공개하지 않는다. */
export async function fetchMyInvite(client: NodiiClient, userId: string, signal?: AbortSignal) {
  const query = client.from('invite_links').select('token').eq('user_id', userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  if (error) throw error;
  return data?.token ?? null;
}

/** SOC-05: 보이지 않는 프로필과 존재하지 않는 링크를 구별하지 않는다. */
export async function resolveInvite(
  client: NodiiClient,
  token: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const query = client.rpc('resolve_invite', { p_token: token }).retry(false);
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  return data;
}
