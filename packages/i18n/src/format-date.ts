import { getLocale, intlLocale, type Locale } from './locale';

/** 날짜만 있는 ISODate가 사용자 시간대에 따라 전날로 밀리지 않도록 UTC로 표시한다. */
export function formatISODate(
  date: string,
  options: Intl.DateTimeFormatOptions,
  locale: Locale = getLocale(),
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { ...options, timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** 일요일 기준 숫자를 문장 조합 없이 해당 언어의 요일 이름으로 바꾼다. */
export function weekdayName(
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6,
  width: 'short' | 'long',
  locale: Locale = getLocale(),
): string {
  return new Intl.DateTimeFormat(intlLocale(locale), { weekday: width, timeZone: 'UTC' }).format(
    new Date(Date.UTC(1970, 0, 4 + day)),
  );
}
