import {
  keyBetween,
  normalizeSearchQuery,
  type FollowRelation,
  type ReportReason,
} from '@nodii/core';
import type { NodiiClient } from '../client';
import { mapBlockedProfile, mapSocialProfile, socialProfileFields } from '../mappers';

export const FOLLOW_LIST_LIMIT = 500;
export const followLists = ['following', 'followers'] as const;
export type FollowList = (typeof followLists)[number];

/** SOC-10: 한 화면에 필요한 양방향 관계를 두 요청으로 읽는다. */
export async function fetchRelations(
  client: NodiiClient,
  me: string,
  userIds: readonly string[],
  signal?: AbortSignal,
) {
  const ids = [...new Set(userIds)];
  const relations = new Map<string, FollowRelation>(
    ids.map((id) => [id, { iFollow: false, followsMe: false }]),
  );
  if (!ids.length) return relations;
  const outgoing = client
    .from('follows')
    .select('followee_id')
    .eq('follower_id', me)
    .in('followee_id', ids);
  const incoming = client
    .from('follows')
    .select('follower_id')
    .eq('followee_id', me)
    .in('follower_id', ids);
  const [sent, received] = await Promise.all([
    signal ? outgoing.abortSignal(signal) : outgoing,
    signal ? incoming.abortSignal(signal) : incoming,
  ]);
  if (sent.error) throw sent.error;
  if (received.error) throw received.error;
  for (const row of sent.data) {
    const relation = relations.get(row.followee_id);
    if (relation) relation.iFollow = true;
  }
  for (const row of received.data) {
    const relation = relations.get(row.follower_id);
    if (relation) relation.followsMe = true;
  }
  return relations;
}

/** SOC-10·36: 새 사람을 내 팔로우 순서 맨 뒤에 넣는다. */
export async function follow(client: NodiiClient, me: string, targetId: string) {
  const { data, error } = await client
    .from('follows')
    .select('today_sort_key')
    .eq('follower_id', me)
    .order('today_sort_key', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const result = await client.from('follows').insert({
    follower_id: me,
    followee_id: targetId,
    today_sort_key: keyBetween(data?.today_sort_key ?? null, null),
  });
  if (result.error && result.error.code !== '23505') throw result.error;
}

/** SOC-11: 내가 만든 방향의 관계만 삭제한다. */
export async function unfollow(client: NodiiClient, me: string, targetId: string) {
  const { error } = await client
    .from('follows')
    .delete()
    .eq('follower_id', me)
    .eq('followee_id', targetId);
  if (error) throw error;
}

/** SOC-12: 나를 팔로우하는 방향만 삭제한다. */
export async function removeFollower(client: NodiiClient, me: string, followerId: string) {
  return unfollow(client, followerId, me);
}

async function fetchFollowList(
  client: NodiiClient,
  me: string,
  kind: FollowList,
  signal: AbortSignal,
) {
  const owner = kind === 'following' ? 'follower_id' : 'followee_id';
  const person = kind === 'following' ? 'followee_id' : 'follower_id';
  const { data, error, count } = await client
    .from('follows')
    .select('follower_id,followee_id', { count: 'exact' })
    .eq(owner, me)
    .order('created_at', { ascending: false })
    .order(person)
    .limit(FOLLOW_LIST_LIMIT)
    .abortSignal(signal);
  if (error) throw error;
  const ids = data.map((row) => row[person]);
  const truncated = (count ?? 0) > FOLLOW_LIST_LIMIT;
  if (!ids.length) return { people: [], truncated };
  // S1의 follows FK는 auth.users를 가리킨다. 공개 프로필은 별도 일괄 조회로 RLS를 적용한다.
  // UUID 500개를 GET 한 번에 실으면 프록시의 URL 한도를 넘을 수 있다.
  const batches = Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) =>
    ids.slice(i * 100, (i + 1) * 100),
  );
  const profiles = await Promise.all(
    batches.map(async (batch) => {
      const { data: rows, error: profileError } = await client
        .from('social_profiles')
        .select(socialProfileFields)
        .in('user_id', batch)
        .abortSignal(signal);
      if (profileError) throw profileError;
      return rows;
    }),
  );
  const byId = new Map(profiles.flat().map((row) => [row.user_id, mapSocialProfile(row, false)]));
  const people = ids.flatMap((id) => byId.get(id) ?? []);
  return { people, truncated };
}

/** SOC-12: 최근 팔로우부터 최대 500명을 조회한다. */
export const fetchFollowing = (client: NodiiClient, me: string, signal: AbortSignal) =>
  fetchFollowList(client, me, 'following', signal);

/** SOC-12: 최근 팔로워부터 최대 500명을 조회한다. */
export const fetchFollowers = (client: NodiiClient, me: string, signal: AbortSignal) =>
  fetchFollowList(client, me, 'followers', signal);

/** SOC-08: 표시 가능한 프로필 수와 실제 관계 수를 구별한다. */
export async function fetchFollowCounts(client: NodiiClient, me: string, signal: AbortSignal) {
  const [sent, received] = await Promise.all([
    client
      .from('follows')
      .select('followee_id', { count: 'exact', head: true })
      .eq('follower_id', me)
      .abortSignal(signal),
    client
      .from('follows')
      .select('follower_id', { count: 'exact', head: true })
      .eq('followee_id', me)
      .abortSignal(signal),
  ]);
  if (sent.error) throw sent.error;
  if (received.error) throw received.error;
  return { following: sent.count ?? 0, followers: received.count ?? 0 };
}

/** SOC-06·08: 서버의 검색 순서와 검색 허용 여부를 그대로 따른다. */
export async function searchProfiles(client: NodiiClient, raw: string, signal: AbortSignal) {
  const query = normalizeSearchQuery(raw);
  if (!query) return [];
  const { data, error } = await client
    .rpc('search_profiles', { p_query: query })
    .abortSignal(signal)
    .retry(false);
  if (error) throw error;
  return data.map((row) => mapSocialProfile(row, false));
}

/** SOC-60: 차단과 양방향 팔로우 제거를 서버 트리거에 맡긴다. */
export async function block(client: NodiiClient, me: string, targetId: string) {
  const { error } = await client.from('blocks').insert({ blocker_id: me, blocked_id: targetId });
  if (error && error.code !== '23505') throw error;
}

/** SOC-61: 내가 만든 차단만 해제한다. */
export async function unblock(client: NodiiClient, me: string, targetId: string) {
  const { error } = await client
    .from('blocks')
    .delete()
    .eq('blocker_id', me)
    .eq('blocked_id', targetId);
  if (error) throw error;
}

/** SOC-61: 기존 프로필 RLS에서 숨긴 이름과 사진을 전용 RPC에서 읽는다. */
export async function fetchBlockedProfiles(client: NodiiClient, signal: AbortSignal) {
  const { data, error } = await client.rpc('my_blocked_profiles').abortSignal(signal);
  if (error) throw error;
  return data.map(mapBlockedProfile);
}

export interface ReportProfileInput {
  targetUserId: string;
  reason: ReportReason;
  detail?: string;
  alsoBlock: boolean;
}

export interface ReportTodoInput extends ReportProfileInput {
  todoId: string;
}

/** SOC-62: 신고 저장을 확인한 뒤 선택한 차단을 처리한다. */
export async function reportProfile(
  client: NodiiClient,
  me: string,
  { alsoBlock, ...input }: ReportProfileInput | ReportTodoInput,
) {
  const { targetUserId, ...body } = input;
  const { data, error } = await client.functions.invoke<{ ok: boolean }>('report-profile', {
    body: 'todoId' in body ? body : { ...body, targetUserId },
  });
  if (error) throw error;
  if (!data?.ok) throw new Error('invalid_report_response');
  if (!alsoBlock) return { blocked: false, blockFailed: false };
  try {
    await block(client, me, targetUserId);
    return { blocked: true, blockFailed: false };
  } catch {
    return { blocked: false, blockFailed: true };
  }
}
