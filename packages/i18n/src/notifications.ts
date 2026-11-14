import { formatISODate } from './format-date';
import { t, type MessageParams } from './translate';
import type { MessageKey } from './catalog.ko';

/** SOC-56: 한 문장을 번역한 뒤 이름에만 서식을 줄 수 있게 나눈다. */
export function notificationNameParts(key: MessageKey, params: MessageParams & { name: string }) {
  let marker = '\u0000';
  while (Object.values(params).some((value) => String(value).includes(marker))) marker += '\u0000';
  const [before = '', after = ''] = t(key, { ...params, name: marker }).split(marker);
  return { before, name: params.name, after };
}

/** SOC-56: 오늘은 경과 시간, 이번 주는 요일, 이전은 달력 날짜로 표시한다. */
export function formatNotificationTime(
  timestamp: string,
  date: string,
  section: 'today' | 'thisWeek' | 'earlier',
  now: Date,
) {
  if (section === 'thisWeek') return formatISODate(date, { weekday: 'long' });
  if (section === 'earlier')
    return formatISODate(date, { year: 'numeric', month: 'short', day: 'numeric' });
  const minutes = Math.max(0, Math.floor((now.getTime() - Date.parse(timestamp)) / 60_000));
  return minutes < 1
    ? t('social.notifications.justNow')
    : minutes < 60
      ? t('social.notifications.minutes', { count: minutes })
      : t('social.notifications.hours', { count: Math.floor(minutes / 60) });
}
