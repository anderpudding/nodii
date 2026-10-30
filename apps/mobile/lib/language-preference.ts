import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getLocales } from 'expo-localization';
import { resolveLocale, setLocale, type LanguagePreference } from '@nodii/i18n';
import { create } from 'zustand';
import { withStartupTimeout } from './startup-timeout';

const key = 'nodii.language';
export const useLanguagePreference = create<{ preference: LanguagePreference }>(() => ({
  preference: 'system',
}));
function apply(preference: LanguagePreference) {
  setLocale(
    resolveLocale(
      preference,
      getLocales().map((locale) => locale.languageTag),
    ),
  );
  useLanguagePreference.setState({ preference });
}
/** SET-06: 읽기 실패·시간 초과에도 기기 언어로 첫 화면을 준비하고 호출자에게 오류를 알린다. */
export async function restoreLanguage() {
  try {
    const value = await withStartupTimeout(AsyncStorage.getItem(key));
    apply(value === 'ko' || value === 'en' ? value : 'system');
  } catch (error) {
    apply('system');
    throw error;
  }
}
/** SET-06: 디스크 저장이 끝나기 전에는 화면 언어와 이전 선택을 바꾸지 않는다. */
export async function saveLanguage(preference: LanguagePreference) {
  await AsyncStorage.setItem(key, preference);
  apply(preference);
}
/** SET-06: 명시적으로 고른 언어는 유지하고 시스템 선택만 복귀 시 다시 읽는다. */
export function bindLanguage() {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active' && useLanguagePreference.getState().preference === 'system') {
      apply('system');
    }
  });
  return () => subscription.remove();
}
