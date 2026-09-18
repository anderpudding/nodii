import type { Profile } from '@nodii/core';
import type { NodiiClient } from './client';
import { mapProfile } from './mappers';

/** 로그인한 사용자의 설정만 가져온다. 접근 권한은 RLS가 검증한다. */
export async function fetchProfile(
  client: NodiiClient,
  userId: string,
  signal?: AbortSignal,
): Promise<Profile> {
  let query = client.from('profiles').select('*').eq('id', userId);
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.single();
  if (error) throw error;
  return mapProfile(data);
}

/** G2: 기본 UTC를 기기 시간대로 맞추되 불필요한 UPDATE를 피한다. */
export async function syncProfileTimezone(
  client: NodiiClient,
  userId: string,
  timezone: string,
  signal?: AbortSignal,
): Promise<Profile> {
  const profile = await fetchProfile(client, userId, signal);
  if (profile.timezone === timezone) return profile;
  let query = client.from('profiles').update({ timezone }).eq('id', userId).select('*');
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query.single();
  if (error) throw error;
  return mapProfile(data);
}
