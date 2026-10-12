import { expect, it } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { restoreTheme, saveTheme, useThemePreference } from './theme-preference';
it('세 가지 기기 테마를 저장·재실행 복원하고 잘못된 값은 시스템으로 돌아간다', async () => {
  for (const value of ['light', 'dark', 'system'] as const) {
    await saveTheme(value);
    useThemePreference.setState({ preference: 'system' });
    await restoreTheme();
    expect(useThemePreference.getState().preference).toBe(value);
  }
  await AsyncStorage.setItem('nodii.theme', 'invalid');
  await restoreTheme();
  expect(useThemePreference.getState().preference).toBe('system');
});
