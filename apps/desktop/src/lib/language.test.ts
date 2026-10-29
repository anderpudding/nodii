import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { getLocale } from '@nodii/i18n';
import { toast } from 'sonner';
import { load } from '@tauri-apps/plugin-store';
import { installAppMenu } from './commands';
import { setLanguage, startLanguage } from './language';

const native = vi.hoisted(() => ({ value: false }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => native.value }));
vi.mock('@tauri-apps/plugin-store', () => ({ load: vi.fn() }));
vi.mock('./commands', () => ({ installAppMenu: vi.fn().mockResolvedValue(undefined) }));

const stops: (() => void)[] = [];
const store = { get: vi.fn(), set: vi.fn(), save: vi.fn() };
function start() {
  const stop = startLanguage();
  stops.push(stop);
  return stop;
}
function system(languages: readonly string[]) {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  window.dispatchEvent(new Event('languagechange'));
}
beforeEach(async () => {
  native.value = false;
  await setLanguage('ko');
  await Promise.resolve();
  vi.clearAllMocks();
  vi.mocked(load).mockResolvedValue(store as unknown as Awaited<ReturnType<typeof load>>);
  store.get.mockResolvedValue('ko');
  store.set.mockResolvedValue(undefined);
  store.save.mockResolvedValue(undefined);
});
afterEach(() => {
  stops.splice(0).forEach((stop) => stop());
  vi.restoreAllMocks();
  native.value = false;
});

it('미러를 즉시 적용하고 다시 시작해도 명시한 언어를 유지한다', async () => {
  localStorage.setItem('nodii-language', 'en');
  const stop = start();
  expect(getLocale()).toBe('en');
  expect(document.documentElement.lang).toBe('en');
  stop();
  start();
  await Promise.resolve();
  expect(installAppMenu).toHaveBeenCalledOnce();
  expect(load).not.toHaveBeenCalled();
});

it.each([null, 'invalid'])('미러 %s는 system으로 간주하고 첫 OS 선호를 쓴다', (value) => {
  if (value === null) localStorage.removeItem('nodii-language');
  else localStorage.setItem('nodii-language', value);
  system(['en-CA', 'ko-KR']);
  start();
  expect(getLocale()).toBe('en');
});

it('languagechange는 system에서만 적용하고 정리 후에는 듣지 않는다', async () => {
  system(['ko-KR']);
  await setLanguage('system');
  const stop = start();
  system(['en-US']);
  expect(getLocale()).toBe('en');
  await setLanguage('ko');
  system(['en-GB']);
  expect(getLocale()).toBe('ko');
  await setLanguage('system');
  stop();
  system(['ko-KR']);
  expect(getLocale()).toBe('en');
});

it('store 원본을 적용하고 같은 언어의 초기화는 메뉴를 중복 설치하지 않는다', async () => {
  native.value = true;
  localStorage.setItem('nodii-language', 'en');
  store.get.mockResolvedValue('en');
  start()();
  start();
  await vi.waitFor(() => expect(localStorage.getItem('nodii-language')).toBe('en'));
  await vi.waitFor(() => expect(store.get).toHaveBeenCalledTimes(2));
  expect(installAppMenu).toHaveBeenCalledOnce();
  expect(load).toHaveBeenCalledWith('settings.json', { autoSave: false });
});

it('원본을 읽는 동안 고른 언어를 이전 원본이 덮어쓰지 않는다', async () => {
  native.value = true;
  let complete!: (value: string) => void;
  store.get.mockReturnValue(
    new Promise<string>((resolve) => {
      complete = resolve;
    }),
  );
  start();
  await vi.waitFor(() => expect(store.get).toHaveBeenCalled());
  await setLanguage('en');
  complete('ko');
  await Promise.resolve();
  expect(getLocale()).toBe('en');
  expect(localStorage.getItem('nodii-language')).toBe('en');
  expect(store.set).toHaveBeenCalledWith('language', 'en');
  expect(store.save).toHaveBeenCalledOnce();
});

it('store 저장 실패는 화면과 html을 되돌리고 오류를 던진다', async () => {
  native.value = true;
  store.save.mockRejectedValueOnce(new Error('disk full'));
  await expect(setLanguage('en')).rejects.toThrow('disk full');
  expect(getLocale()).toBe('ko');
  expect(document.documentElement.lang).toBe('ko');
  expect(localStorage.getItem('nodii-language')).toBe('ko');
});

it('미러 저장 실패도 되돌리고 오류를 던진다', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
    throw new Error('blocked');
  });
  await expect(setLanguage('en')).rejects.toThrow('blocked');
  expect(getLocale()).toBe('ko');
});

it('원본을 읽지 못하면 로딩 오류를 알린다', async () => {
  native.value = true;
  vi.mocked(load).mockRejectedValueOnce(new Error('unavailable'));
  const error = vi.spyOn(toast, 'error');
  start();
  await vi.waitFor(() => expect(error).toHaveBeenCalledWith('언어 설정을 불러오지 못했어요'));
});

it('언어가 바뀔 때 메뉴를 다시 설치하고 실패를 알린다', async () => {
  await setLanguage('en');
  await vi.waitFor(() => expect(installAppMenu).toHaveBeenCalledOnce());
  const error = vi.spyOn(toast, 'error');
  vi.mocked(installAppMenu).mockRejectedValueOnce(new Error('IPC'));
  await setLanguage('ko');
  await vi.waitFor(() =>
    expect(error).toHaveBeenCalledWith('메뉴를 준비하지 못했어요. 앱을 다시 열어 주세요.'),
  );
});
