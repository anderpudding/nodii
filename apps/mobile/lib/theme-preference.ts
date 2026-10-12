import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
export type ThemePreference = 'system' | 'light' | 'dark';
const key = 'nodii.theme';
export const useThemePreference = create<{ preference: ThemePreference }>(() => ({
  preference: 'system',
}));
/** SET-02/I5: 기기 테마만 읽고 서버 프로필에 복사하지 않는다. */
export async function restoreTheme() {
  const value = await AsyncStorage.getItem(key);
  useThemePreference.setState({
    preference: value === 'light' || value === 'dark' ? value : 'system',
  });
}
/** 저장 실패 시 이전 테마를 유지하고 호출 화면에서 오류를 알린다. */
export async function saveTheme(preference: ThemePreference) {
  await AsyncStorage.setItem(key, preference);
  useThemePreference.setState({ preference });
}
