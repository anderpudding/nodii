import { afterEach, expect, it, vi } from 'vitest';
import { setLocale } from './locale';
import { formatList, ordinal } from './format-list';
import { t } from './translate';
const nativePlural = Intl.PluralRules;
const nativeList = Intl.ListFormat;
afterEach(() => {
  vi.unstubAllGlobals();
  setLocale('ko');
});
it('Hermes에서 빠진 Intl 생성자 없이 기존 영어 개수·목록·서수를 유지한다', () => {
  vi.stubGlobal(
    'Intl',
    Object.create(Intl, { PluralRules: { value: undefined }, ListFormat: { value: undefined } }),
  );
  setLocale('en');
  expect(t('goal.total', { count: 1 })).toBe('1 goal');
  expect(t('goal.total', { count: 2 })).toBe('2 goals');
  for (const items of [[], ['Mon'], ['Mon', 'Wed'], ['Mon', 'Wed', 'Fri']])
    expect(formatList(items)).toBe(new nativeList('en-US', { type: 'conjunction' }).format(items));
  for (let n = 1; n <= 131; n++) {
    const suffix = { one: 'st', two: 'nd', few: 'rd', other: 'th', zero: 'th', many: 'th' }[
      new nativePlural('en-US', { type: 'ordinal' }).select(n)
    ];
    expect(ordinal(n)).toBe(`${n}${suffix}`);
  }
  setLocale('ko');
  expect(formatList(['월', '수', '금'])).toBe('월·수·금');
  expect(ordinal(31)).toBe('31');
});
