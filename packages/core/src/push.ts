import type { NotificationKind } from './notifications';

const windowMs = 3 * 60 * 60 * 1000;

/** SOC-51: 친구 완료 간격과 기기의 조용한 시간을 모두 지킨다. */
export function shouldDeliverPush({
  kind,
  now,
  timeZone,
  lastSentAt,
}: {
  kind: NotificationKind;
  now: Date;
  timeZone: string;
  lastSentAt?: string | null;
}) {
  if (kind === 'friend_done' && lastSentAt && now.getTime() - Date.parse(lastSentAt) < windowMs)
    return false;
  try {
    const hour = Number(
      new Intl.DateTimeFormat('en', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now),
    );
    return hour >= 8 && hour < 23;
  } catch {
    return false;
  }
}
