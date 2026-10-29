import { getLocale, type Locale } from './locale';

/** SET-06: 한국어의 가운뎃점과 영어의 접속사를 문장 밖에서 일관되게 고른다. */
export function formatList(items: readonly string[], locale: Locale = getLocale()): string {
  return locale === 'ko'
    ? items.join('·')
    : new Intl.ListFormat('en-US', { type: 'conjunction' }).format(items);
}

/** SET-06: 반복 날짜의 영어 서수는 11·12·13일 예외까지 Intl 규칙을 따른다. */
export function ordinal(n: number, locale: Locale = getLocale()): string {
  if (locale === 'ko') return String(n);
  const suffixes: Partial<Record<Intl.LDMLPluralRule, string>> = {
    one: 'st',
    two: 'nd',
    few: 'rd',
  };
  const rule = new Intl.PluralRules('en-US', { type: 'ordinal' }).select(n);
  return `${n}${suffixes[rule] ?? 'th'}`;
}
