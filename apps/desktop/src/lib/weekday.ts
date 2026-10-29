import { weekdayName } from '@nodii/i18n';

/** SET-06: 사용하는 시점의 로케일로 요일을 표시한다. */
export function weekdayShort(day: number): string {
  if (!Number.isInteger(day) || day < 0 || day > 6) return '';
  return weekdayName(day as 0 | 1 | 2 | 3 | 4 | 5 | 6, 'short');
}
