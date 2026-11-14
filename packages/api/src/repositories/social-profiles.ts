import type { DefaultVisibility } from '@nodii/core';
import type { NodiiClient } from '../client';
import {
  mapProfile,
  mapSocialProfile,
  socialProfileFields,
  socialProfilePatchToRow,
  type SocialProfilePatch,
} from '../mappers';

/** SOC-03: 없는 행과 조회 실패를 구별해 기존 프로필에 시작 화면을 덮지 않는다. */
export async function fetchMySocialProfile(
  client: NodiiClient,
  userId: string,
  signal?: AbortSignal,
) {
  const query = client.from('social_profiles').select(socialProfileFields).eq('user_id', userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  if (error) throw error;
  return data ? mapSocialProfile(data, true) : null;
}

/** SOC-38: 차단·정지는 RLS에 맡기고 자동 숨김이 설정된 소개·사진은 캐시에 남기지 않는다. */
export async function fetchSocialProfile(
  client: NodiiClient,
  userId: string,
  signal?: AbortSignal,
) {
  const query = client.from('social_profiles').select(socialProfileFields).eq('user_id', userId);
  const { data, error } = await (signal ? query.abortSignal(signal) : query).maybeSingle();
  if (error) throw error;
  return data ? mapSocialProfile(data, false) : null;
}

/** SOC-03: 프로필과 초대 토큰은 같은 서버 트랜잭션에서 생성된다. */
export async function createSocialProfile(
  client: NodiiClient,
  userId: string,
  input: Pick<SocialProfilePatch, 'handle' | 'nickname'> & { handle: string; nickname: string },
) {
  const { data, error } = await client
    .from('social_profiles')
    .insert({ user_id: userId, handle: input.handle, nickname: input.nickname })
    .select(socialProfileFields)
    .single();
  if (error) throw error;
  return mapSocialProfile(data, true);
}

/** SOC-01·02·06·07: 화면에서 바꾼 필드만 저장한다. */
export async function updateSocialProfile(
  client: NodiiClient,
  userId: string,
  patch: SocialProfilePatch,
) {
  const { data, error } = await client
    .from('social_profiles')
    .update(socialProfilePatchToRow(patch))
    .eq('user_id', userId)
    .select(socialProfileFields)
    .single();
  if (error) throw error;
  return mapSocialProfile(data, true);
}

const handleStates = ['ok', 'taken', 'held', 'reserved', 'banned', 'invalid'] as const;
export type HandleAvailability = (typeof handleStates)[number];

/** SOC-02: 전체 계정의 ID 중복·보류·금칙어는 서버가 판정한다. */
export async function checkHandle(
  client: NodiiClient,
  handle: string,
  signal?: AbortSignal,
): Promise<HandleAvailability> {
  const query = client.rpc('handle_available', { p_handle: handle }).retry(false);
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  const state = handleStates.find((state) => state === data);
  if (!state) throw new Error('invalid_handle_response');
  return state;
}

/** SOC-64: 같은 DB 목록으로 입력 중 안내하고 저장 권한은 트리거에 맡긴다. */
export async function checkProfileText(
  client: NodiiClient,
  value: string,
  nickname: boolean,
  signal: AbortSignal,
) {
  const [allowed, reserved] = await Promise.all([
    client.rpc('text_is_allowed', { t: value }).abortSignal(signal).retry(false),
    nickname ? client.rpc('text_is_reserved', { t: value }).abortSignal(signal).retry(false) : null,
  ]);
  if (allowed.error) throw allowed.error;
  if (reserved?.error) throw reserved.error;
  return reserved?.data ? 'reserved' : !allowed.data ? 'banned' : 'ok';
}

/** SOC-28: 이미 있는 목표에는 영향을 주지 않고 설정만 변경한다. */
export async function updateDefaultVisibility(
  client: NodiiClient,
  userId: string,
  visibility: DefaultVisibility,
) {
  const { data, error } = await client
    .from('profiles')
    .update({ default_visibility: visibility })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return mapProfile(data);
}
