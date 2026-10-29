import { t, type MessageKey } from '@nodii/i18n';

const weekdayKeys = [
  'date.weekday.short.0',
  'date.weekday.short.1',
  'date.weekday.short.2',
  'date.weekday.short.3',
  'date.weekday.short.4',
  'date.weekday.short.5',
  'date.weekday.short.6',
] as const satisfies readonly MessageKey[];

/** I1: 요일은 사용하는 시점에 꺼내어 I2의 실행 중 언어 전환을 준비한다. */
export function weekdayShort(day: number): string {
  const key = weekdayKeys[day];
  return key === undefined ? '' : t(key);
}
