import { beforeEach, expect, it, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { getLocales } from 'expo-localization';
import { getLocale, setLocale } from '@nodii/i18n';
import {
  bindLanguage,
  restoreLanguage,
  saveLanguage,
  useLanguagePreference,
} from './language-preference';

beforeEach(() => {
  vi.restoreAllMocks();
  setLocale('ko');
  useLanguagePreference.setState({ preference: 'system' });
  vi.mocked(getLocales).mockReturnValue([{ ...getLocales()[0], languageTag: 'ko-KR' }]);
});
it('저장한 세 설정을 복원하고 잘못된 값·빈 기기 언어는 영어 system으로 해석한다', async () => {
  for (const value of ['ko', 'en', 'system'] as const) {
    await AsyncStorage.setItem('nodii.language', value);
    await restoreLanguage();
    expect(useLanguagePreference.getState().preference).toBe(value);
    expect(getLocale()).toBe(value === 'en' ? 'en' : 'ko');
  }
  vi.mocked(getLocales).mockReturnValue([] as unknown as ReturnType<typeof getLocales>);
  await AsyncStorage.setItem('nodii.language', 'broken');
  await restoreLanguage();
  expect(useLanguagePreference.getState().preference).toBe('system');
  expect(getLocale()).toBe('en');
});
it('저장 실패는 이전 언어와 선택을 보존한다', async () => {
  await saveLanguage('ko');
  vi.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
  await expect(saveLanguage('en')).rejects.toThrow('disk');
  expect(getLocale()).toBe('ko');
  expect(useLanguagePreference.getState().preference).toBe('ko');
});
it('읽기 실패는 system을 적용하고 오류를 전달한다', async () => {
  await saveLanguage('en');
  vi.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('disk'));
  await expect(restoreLanguage()).rejects.toThrow('disk');
  expect(getLocale()).toBe('ko');
  expect(useLanguagePreference.getState().preference).toBe('system');
});
it('active 복귀는 system일 때만 언어를 다시 계산하고 구독을 정리한다', async () => {
  let change: (state: AppStateStatus) => void = () => {};
  const remove = vi.fn();
  vi.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    change = handler;
    return { remove };
  });
  const stop = bindLanguage();
  vi.mocked(getLocales).mockReturnValue([{ ...getLocales()[0], languageTag: 'en-US' }]);
  change('background');
  expect(getLocale()).toBe('ko');
  change('active');
  expect(getLocale()).toBe('en');
  await saveLanguage('ko');
  change('active');
  expect(getLocale()).toBe('ko');
  stop();
  expect(remove).toHaveBeenCalledOnce();
});
