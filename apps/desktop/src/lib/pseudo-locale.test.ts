import { afterEach, expect, it, vi } from 'vitest';
import { setLocale, setPseudoLocale, t } from '@nodii/i18n';
import { configurePseudoLocale } from './pseudo-locale';

afterEach(() => {
  vi.unstubAllEnvs();
  setLocale('ko');
  setPseudoLocale(false);
});

it.each([
  [true, '1', true],
  [true, undefined, false],
  [true, '0', false],
  [false, '1', false],
])('DEV=%s flag=%s일 때 pseudo=%s', (dev, flag, enabled) => {
  vi.stubEnv('DEV', dev);
  vi.stubEnv('VITE_PSEUDO_LOCALE', flag);
  configurePseudoLocale();
  setLocale('en');
  expect(t('common.done').startsWith('[')).toBe(enabled);
});
