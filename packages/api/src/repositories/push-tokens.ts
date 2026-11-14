import type { NodiiClient } from '../client';

export interface DevicePushToken {
  token: string;
  userId: string;
  locale: 'ko' | 'en';
  timeZone: string;
  version: string;
}

/** SOC-54: 토큰을 현재 세션에 연결하고, 기기별 발송 설정을 저장한다. */
export async function registerPushToken(client: NodiiClient, value: DevicePushToken) {
  const { error } = await client
    .rpc('register_push_token', {
      p_token: value.token,
      p_locale: value.locale,
      p_time_zone: value.timeZone,
      p_app_version: value.version,
    })
    .retry(false);
  if (error) throw error;
}

/** SOC-54: 로그아웃 전에 현재 계정의 이 기기 토큰만 해제한다. */
export async function removePushToken(client: NodiiClient, userId: string, token: string) {
  const { error } = await client
    .from('push_tokens')
    .delete()
    .eq('user_id', userId)
    .eq('token', token)
    .retry(false);
  if (error) throw error;
}
