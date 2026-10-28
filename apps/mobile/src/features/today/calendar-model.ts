import { addDays, monthGridRange, monthKeyOf, type ISODate } from '@nodii/core';

/** 42칸 캐시 범위는 유지하고 해당 월이 포함된 주만 화면에 표시한다 (CAL-01, MOB-02). */
export function mobileMonthWeeks(month: string, weekStart: 0 | 1): ISODate[][] {
  const { days } = monthGridRange(month, weekStart);
  return Array.from({ length: days.length / 7 }, (_, week) =>
    days.slice(week * 7, week * 7 + 7),
  ).filter((dates) => dates.some((date) => monthKeyOf(date) === month));
}

/** TODO-05: 흔한 이동은 스토어의 오늘을 기준으로 계산한다. */
export function quickDates(today: ISODate) {
  return [today, addDays(today, 1), addDays(today, 7)];
}
/** 날짜 문구에 로컬 시차가 섞이지 않게 달력 날짜를 UTC로 표시한다. */
export function formatMoveDate(date: ISODate) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
