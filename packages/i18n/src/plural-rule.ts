import { intlLocale, type Locale } from './locale';

/** SET-06: Hermes에 생성자가 없을 때도 지원 중인 두 언어의 같은 규칙을 적용한다. */
export function selectPluralRule(
  count: number,
  locale: Locale,
  type: 'cardinal' | 'ordinal' = 'cardinal',
): Intl.LDMLPluralRule {
  if (typeof Intl.PluralRules === 'function') {
    return new Intl.PluralRules(intlLocale(locale), { type }).select(count);
  }
  if (locale === 'ko') return 'other';
  // Intl 기본 최대 소수 3자리와 절댓값 규칙을 보존한다. 실제 개수·반복 일자는 정수다.
  const n = Math.abs(Number(count.toFixed(3)));
  if (type === 'cardinal') return n === 1 ? 'one' : 'other';
  const last = n % 10;
  const lastTwo = n % 100;
  if (last === 1 && lastTwo !== 11) return 'one';
  if (last === 2 && lastTwo !== 12) return 'two';
  if (last === 3 && lastTwo !== 13) return 'few';
  return 'other';
}
