import { addDays, type ISODate } from '@nodii/core';

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
