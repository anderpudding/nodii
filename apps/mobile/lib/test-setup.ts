import { beforeEach, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    default: {
      getItem: vi.fn(async (key: string) => values.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => {
        values.set(key, value);
      }),
      removeItem: vi.fn(async (key: string) => {
        values.delete(key);
      }),
    },
  };
});

vi.mock('expo-localization', () => ({ getLocales: vi.fn(() => [{ languageTag: 'ko-KR' }]) }));
import { setLocale, setPseudoLocale } from '@nodii/i18n';
beforeEach(() => {
  setLocale('ko');
  setPseudoLocale(false);
});
