import type { ISODate } from './types';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 'YYYY-MM-DD' 형식이면서 실제로 존재하는 날짜인지 확인한다. */
export function isISODate(value: string): value is ISODate {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1) return false;

  // 날짜 계산은 UTC 기준으로만 해서 로컬 시간대·DST 영향을 받지 않게 한다.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= lastDay;
}

/** 텍스트 필드 등에서 받은 값을 검증한다. */
export function assertISODate(value: string): ISODate {
  if (!isISODate(value)) {
    throw new RangeError(`Invalid ISO date: ${value}`);
  }
  return value;
}
