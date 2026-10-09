import { fetchMinAppVersion, type NodiiClient } from '@nodii/api';
import { compareVersion } from '@nodii/core';

export interface UpdateInfo {
  current: string;
  minimum: string;
}
/** SET-05: 서버 조회 실패와 잘못된 버전은 앱 시작을 막지 않는다. */
export async function checkMobileVersion(
  client: NodiiClient,
  current: string,
): Promise<UpdateInfo | null> {
  try {
    const minimum = await fetchMinAppVersion(client, 'min_ios_app_version');
    return minimum && compareVersion(current, minimum) < 0 ? { current, minimum } : null;
  } catch {
    return null;
  }
}
/** SET-05: 배포 설정이 없으면 임의의 스토어 앱으로 보내지 않는다. */
export function appStoreUrl(id: string): string | null {
  return /^\d+$/.test(id.trim()) ? `https://apps.apple.com/app/id${id.trim()}` : null;
}
