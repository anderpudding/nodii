import type * as Api from '@nodii/api';
import { expect, it, vi } from 'vitest';
import { fetchMinAppVersion, type NodiiClient } from '@nodii/api';
vi.mock('@nodii/api', async (original) => ({
  ...(await original<typeof Api>()),
  fetchMinAppVersion: vi.fn(),
}));
import { appStoreUrl, checkMobileVersion } from './version-gate';
const client = {} as NodiiClient;
it.each([
  ['0.1.0', '0.2.0', true],
  ['0.2.0', '0.2.0', false],
  ['0.10.0', '0.2.0', false],
  ['broken', '0.2.0', false],
])('현재 %s / 최소 %s의 게이트', async (current, minimum, blocked) => {
  vi.mocked(fetchMinAppVersion).mockResolvedValueOnce(minimum);
  expect(!!(await checkMobileVersion(client, current))).toBe(blocked);
  expect(fetchMinAppVersion).toHaveBeenLastCalledWith(client, 'min_ios_app_version');
});
it('조회 실패 또는 설정 없음은 통과한다', async () => {
  vi.mocked(fetchMinAppVersion)
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(null);
  expect(await checkMobileVersion(client, '0.1.0')).toBeNull();
  expect(await checkMobileVersion(client, '0.1.0')).toBeNull();
});
it('설정된 숫자 App Store ID만 연다', () => {
  expect(appStoreUrl(' 123456 ')).toBe('https://apps.apple.com/app/id123456');
  expect(appStoreUrl('')).toBeNull();
  expect(appStoreUrl('https://other.test')).toBeNull();
});
