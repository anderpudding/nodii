import { compareVersion } from '@nodii/core';
import type { NodiiClient } from './client';

/** SET-05: 오프라인·잘못된 설정·느린 서버가 앱 시작을 막지 않게 한다. */
export async function fetchMinAppVersion(
  client: NodiiClient,
  key: 'min_macos_app_version' | 'min_ios_app_version',
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const { data, error } = await client
      .from('app_config')
      .select('value')
      .eq('key', key)
      .abortSignal(controller.signal)
      .maybeSingle()
      .retry(false);
    if (error || !data) return null;
    compareVersion(data.value, data.value);
    return data.value;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/** D13: 성공적으로 읽은 정확한 true 값만 소셜 화면을 켠다. */
export async function fetchSocialEnabled(client: NodiiClient): Promise<boolean> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const request = async () => {
      const { data, error } = await client
        .from('app_config')
        .select('value')
        .eq('key', 'social_enabled')
        .abortSignal(controller.signal)
        .maybeSingle()
        .retry(false);
      return !error && data?.value === 'true';
    };
    return await Promise.race([
      request(),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => {
          controller.abort();
          resolve(false);
        }, 3000);
      }),
    ]);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
