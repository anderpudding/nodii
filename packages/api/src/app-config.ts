import { compareVersion } from '@nodii/core';
import type { NodiiClient } from './client';

/** SET-05: 오프라인·잘못된 설정·느린 서버가 앱 시작을 막지 않게 한다. */
export async function fetchMinAppVersion(client: NodiiClient): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const { data, error } = await client
      .from('app_config')
      .select('value')
      .eq('key', 'min_macos_app_version')
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
