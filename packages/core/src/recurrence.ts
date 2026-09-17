import {
  daysBetween,
  fromEpochDay,
  isLastDayOfMonth,
  monthsBetween,
  startOfWeek,
  toEpochDay,
  weekdayOf,
} from './date';
import type { ISODate, Routine } from './types';

/** 저장된 규칙만으로 날짜별 항목을 판정한다 (ROUT-02~04). */
export function occursOn(routine: Routine, date: ISODate): boolean {
  if (date < routine.startDate || (routine.endDate !== null && date > routine.endDate))
    return false;
  switch (routine.freq) {
    case 'daily':
      return daysBetween(routine.startDate, date) % routine.repeatEvery === 0;
    case 'weekly':
      // I1: 표시용 주 시작 설정을 바꿔도 반복 날짜는 일요일 기준으로 고정한다.
      return (
        (routine.byWeekday?.includes(weekdayOf(date)) ?? false) &&
        (daysBetween(startOfWeek(routine.startDate, 0), startOfWeek(date, 0)) / 7) %
          routine.repeatEvery ===
          0
      );
    case 'monthly': {
      if (monthsBetween(routine.startDate, date) % routine.repeatEvery !== 0) return false;
      const day = Number(date.slice(8));
      return (
        routine.byMonthday?.some(
          (selected) => selected === day || (selected > day && isLastDayOfMonth(date)),
        ) ?? false
      );
    }
  }
}

/** from 당일부터 최대 1,098일만 검색해 미리보기가 무한 대기하지 않게 한다. */
export function nextOccurrences(routine: Routine, from: ISODate, count: number): ISODate[] {
  if (!Number.isInteger(count) || count < 0)
    throw new RangeError('Count must be a non-negative integer');
  const dates: ISODate[] = [];
  const start = toEpochDay(from);
  const end = Math.min(start + 366 * 3 - 1, toEpochDay(routine.endDate ?? '9999-12-31'));
  for (let day = start; day <= end && dates.length < count; day++) {
    const date = fromEpochDay(day);
    if (occursOn(routine, date)) dates.push(date);
  }
  return dates;
}
