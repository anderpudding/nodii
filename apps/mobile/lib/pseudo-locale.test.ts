import { expect, it } from 'vitest';
import { setLocale, t } from '@nodii/i18n';
import { configurePseudoLocale } from './pseudo-locale';
it.each([
  [true, '1', true],
  [true, undefined, false],
  [false, '1', false],
  [false, undefined, false],
] as const)('개발 %s / 플래그 %s → pseudo %s', (development, flag, expected) => {
  setLocale('en');
  configurePseudoLocale(development, flag);
  expect(t('settings.title').startsWith('[')).toBe(expected);
  setLocale('ko');
  expect(t('settings.title')).toBe('설정');
});
