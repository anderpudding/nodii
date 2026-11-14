import { isoDateInZone, startOfWeek, todayISO } from './date';
import type { DayGoalGroup, ISODate } from './types';

export const NOTIFICATION_KINDS = ['friend_done', 'reaction', 'follow'] as const;
export const NOTIFICATION_FILTERS = ['all', ...NOTIFICATION_KINDS] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export type NotificationFilter = (typeof NOTIFICATION_FILTERS)[number];

export interface NotificationPrefs {
  friendDone: boolean;
  newFollower: boolean;
  reaction: boolean;
}

export interface NotificationMute {
  actorId: string;
  friendDone: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: Readonly<NotificationPrefs> = {
  friendDone: false,
  newFollower: true,
  reaction: true,
};

export type ReactionTarget = { todoId: string } | { routineId: string; date: ISODate };

/** SOC-40: 할 일과 날짜별 루틴의 반응 키를 구별한다. */
export function reactionTargetKey(target: ReactionTarget) {
  return 'todoId' in target
    ? `todo:${target.todoId}`
    : `routine:${target.routineId}:${target.date}`;
}

export const NOTIFICATION_SECTIONS = ['today', 'thisWeek', 'earlier'] as const;
export type NotificationSection = (typeof NOTIFICATION_SECTIONS)[number];

/** SOC-56: 최근 활동 시각을 사용자의 달력 날짜로 나눠 서버 순서를 유지한다. */
export function groupNotifications<T extends { updatedAt: string }>(
  rows: readonly T[],
  now: Date,
  timeZone: string,
  weekStart: 0 | 1 = 0,
): Record<NotificationSection, T[]> {
  const today = todayISO(timeZone, now);
  const week = startOfWeek(today, weekStart);
  const groups: Record<NotificationSection, T[]> = { today: [], thisWeek: [], earlier: [] };
  const dates = new Map<string, ISODate>();
  for (const row of rows) {
    let date = dates.get(row.updatedAt);
    if (!date) {
      date = isoDateInZone(row.updatedAt, timeZone);
      dates.set(row.updatedAt, date);
    }
    groups[date >= today ? 'today' : date >= week ? 'thisWeek' : 'earlier'].push(row);
  }
  return groups;
}

/** SOC-56: 가져온 최근 알림에서 한 종류만 골라 표시한다. */
export function filterNotifications<T extends { kind: NotificationKind }>(
  rows: readonly T[],
  filter: NotificationFilter,
): readonly T[] {
  return filter === 'all' ? rows : rows.filter((row) => row.kind === filter);
}

type NotificationSentenceKey =
  | 'social.notifications.sentenceFollow'
  | 'social.notifications.sentenceReaction'
  | 'social.notifications.sentenceFriendDone';

/** SOC-50: 카탈로그가 어순과 복수를 정할 수 있도록 키와 값을 넘긴다. */
export function notificationSentence(row: {
  kind: NotificationKind;
  name: string;
  title: string;
  count: number;
}): { key: NotificationSentenceKey; params: Record<string, string | number> & { name: string } } {
  const { name, title, count } = row;
  switch (row.kind) {
    case 'follow':
      return { key: 'social.notifications.sentenceFollow', params: { name } } as const;
    case 'reaction':
      return { key: 'social.notifications.sentenceReaction', params: { name, title } } as const;
    case 'friend_done':
      return { key: 'social.notifications.sentenceFriendDone', params: { name, count } } as const;
  }
}

/** SOC-51: 사람별 예외가 없을 때만 전체 설정을 쓴다. */
export function effectiveFriendDone(
  prefs: Pick<NotificationPrefs, 'friendDone'> | undefined,
  mutes: readonly NotificationMute[],
  actorId: string,
) {
  return (
    mutes.find((mute) => mute.actorId === actorId)?.friendDone ??
    prefs?.friendDone ??
    DEFAULT_NOTIFICATION_PREFS.friendDone
  );
}

/** SOC-40: 현재 화면에서 하트를 그릴 수 있는 완료 항목만 서버에 묻는다. */
export function completedReactionTargets(groups: readonly DayGoalGroup[], date: ISODate) {
  const todoIds: string[] = [];
  const routineDates: { routineId: string; date: ISODate }[] = [];
  for (const { items } of groups) {
    for (const item of items) {
      if (item.kind === 'todo' && item.todo.isDone) todoIds.push(item.todo.id);
      if (item.kind === 'routine' && item.log?.status === 'done')
        routineDates.push({ routineId: item.routine.id, date });
    }
  }
  return { todoIds, routineDates };
}
