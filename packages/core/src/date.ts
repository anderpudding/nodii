import type { ISODate } from './types';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** 'YYYY-MM-DD' 형식이면서 실제로 존재하는 날짜인지 확인한다. */
export function isISODate(value: string): value is ISODate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match || value.length !== 10) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  // 날짜 계산은 UTC 기준으로만 해서 로컬 시간대·DST 영향을 받지 않게 한다.
  const lastDay = daysInMonth(year, month);
  return day <= lastDay;
}

/** DST와 무관한 정수 일수로 날짜를 계산한다 (NFR-08). */
export function toEpochDay(date: ISODate): number {
  return Date.parse(`${assertISODate(date)}T00:00:00.000Z`) / DAY_MS;
}

/** UTC 일수를 네 자리 연도의 달력 날짜로 복원한다. */
export function fromEpochDay(day: number): ISODate {
  if (!Number.isInteger(day) || day < -719528 || day > 2932896) {
    throw new RangeError('Epoch day is outside the ISO date range');
  }
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** 로컬 시각을 거치지 않아 DST 전환에도 하루씩 이동한다. */
export function addDays(date: ISODate, days: number): ISODate {
  return fromEpochDay(toEpochDay(date) + days);
}

/** 두 달력 날짜의 차이(b - a)를 구한다. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return toEpochDay(b) - toEpochDay(a);
}

/** 1970년 이전에도 0=일요일부터 6=토요일을 반환한다. */
export function weekdayOf(date: ISODate): number {
  return (((toEpochDay(date) + 4) % 7) + 7) % 7;
}

/** 표시 설정 또는 반복 규칙에 지정된 주의 첫날을 구한다. */
export function startOfWeek(date: ISODate, weekStart: 0 | 1): ISODate {
  return addDays(date, -((weekdayOf(date) - weekStart + 7) % 7));
}

/** 윤년과 세기 예외를 적용해 월말 대체 날짜를 계산한다 (ROUT-04). */
export function daysInMonth(year: number, month: number): number {
  if (
    !Number.isInteger(year) ||
    year < 0 ||
    year > 9999 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new RangeError('Invalid calendar month');
  }
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

/** 존재하지 않는 반복 날짜를 그 달의 마지막 날로 모으기 위해 판정한다. */
export function isLastDayOfMonth(date: ISODate): boolean {
  assertISODate(date);
  return Number(date.slice(8)) === daysInMonth(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
}

function monthIndex(date: ISODate): number {
  assertISODate(date);
  return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
}

/** 일자를 무시한 달력 월 차이로 N개월 반복을 판정한다. */
export function monthsBetween(a: ISODate, b: ISODate): number {
  return monthIndex(b) - monthIndex(a);
}

/** 월별 캐시에 사용할 키를 반환한다. */
export function monthKeyOf(date: ISODate): string {
  return assertISODate(date).slice(0, 7);
}

/** 주 시작 설정을 반영한 42칸을 항상 같은 범위로 조회한다 (CAL-05). */
export function monthGridRange(
  monthKey: string,
  weekStart: 0 | 1,
): { from: ISODate; to: ISODate; days: ISODate[] } {
  const from = startOfWeek(assertISODate(`${monthKey}-01`), weekStart);
  return {
    from,
    to: addDays(from, 41),
    days: Array.from({ length: 42 }, (_, i) => addDays(from, i)),
  };
}

/** 겹치는 모든 월 캐시를 갱신하도록 해당 날짜를 포함한 키를 찾는다. */
export function monthKeysContaining(date: ISODate, weekStart: 0 | 1): string[] {
  const index = monthIndex(date);
  const day = toEpochDay(date);
  const keys: string[] = [];
  // 42칸은 인접한 달까지만 닿으므로 이전·현재·다음 달을 확인한다.
  for (let i = Math.max(0, index - 1); i <= Math.min(9999 * 12 + 11, index + 1); i++) {
    const key = `${String(Math.floor(i / 12)).padStart(4, '0')}-${String((i % 12) + 1).padStart(2, '0')}`;
    const first = `${key}-01`;
    const from = toEpochDay(first) - ((weekdayOf(first) - weekStart + 7) % 7);
    if (from <= day && day <= from + 41) keys.push(key);
  }
  return keys;
}

/** 현재 시각을 주입받아 사용자의 시간대에서 오늘을 결정한다 (NFR-08). */
export function todayISO(timeZone: string, now: Date): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return assertISODate(`${values.year?.padStart(4, '0')}-${values.month}-${values.day}`);
}

/** 보관 시각을 사용자 시간대의 달력 날짜로 바꾼다 (I2). */
export function isoDateInZone(instant: string | Date, timeZone: string): ISODate {
  return todayISO(timeZone, typeof instant === 'string' ? new Date(instant) : instant);
}

/** 텍스트 필드 등에서 받은 값을 검증한다. */
export function assertISODate(value: string): ISODate {
  if (!isISODate(value)) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }
  return value;
}
