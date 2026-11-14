import type { SocialProfile, TodayFollow } from '@nodii/core';
import type { NodiiClient } from '../client';
import {
  mapSocialProfile,
  mapTodayFollow,
  socialProfileFields,
  todayFollowPatchToRow,
} from '../mappers';

export type TodayPerson = TodayFollow & { profile: SocialProfile };
export type TodayPersonPatch = Partial<Pick<TodayFollow, 'showOnToday' | 'todaySortKey'>>;

/** SOC-36: 서버가 볼 수 있게 한 팔로잉 프로필만 표시 목록에 넣는다. */
export async function fetchTodayPeople(client: NodiiClient, me: string, signal: AbortSignal) {
  const people: TodayPerson[] = [];
  const size = 100;
  for (let offset = 0; ; offset += size) {
    const { data: edges, error } = await client
      .from('follows')
      .select('followee_id,show_on_today,today_sort_key,created_at')
      .eq('follower_id', me)
      .order('followee_id')
      .range(offset, offset + size - 1)
      .abortSignal(signal);
    if (error) throw error;
    if (!edges.length) return people;
    const { data: profiles, error: profileError } = await client
      .from('social_profiles')
      .select(socialProfileFields)
      .in(
        'user_id',
        edges.map((edge) => edge.followee_id),
      )
      .abortSignal(signal);
    if (profileError) throw profileError;
    const byId = new Map(profiles.map((row) => [row.user_id, mapSocialProfile(row, false)]));
    for (const edge of edges) {
      const profile = byId.get(edge.followee_id);
      if (profile) people.push({ ...mapTodayFollow(edge), profile });
    }
    if (edges.length < size) return people;
  }
}

/** SOC-36: 한 팔로우 행의 표시 여부와 정렬 키만 바꾼다. */
export async function updateTodayPerson(
  client: NodiiClient,
  me: string,
  followeeId: string,
  patch: TodayPersonPatch,
) {
  const { data, error } = await client
    .from('follows')
    .update(todayFollowPatchToRow(patch))
    .eq('follower_id', me)
    .eq('followee_id', followeeId)
    .select('followee_id,show_on_today,today_sort_key,created_at')
    .single();
  if (error) throw error;
  return mapTodayFollow(data);
}
