import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTIFICATION_PREFS,
  effectiveFriendDone,
  filterNotifications,
  groupNotifications,
  notificationSentence,
  type NotificationKind,
} from './notifications';

const row = (kind: NotificationKind, updatedAt: string) => ({ kind, updatedAt });

describe('notifications', () => {
  it('groups by local midnight and the chosen start of week, keeping server order', () => {
    const now = new Date('2026-11-09T08:01:00Z');
    const today = row('reaction', '2026-11-09T08:00:00Z');
    const sunday = row('follow', '2026-11-09T07:59:59Z');
    const saturday = row('friend_done', '2026-11-08T07:59:59Z');
    const rows = [today, sunday, saturday];
    expect(groupNotifications(rows, now, 'America/Vancouver', 0)).toEqual({
      today: [today],
      thisWeek: [sunday],
      earlier: [saturday],
    });
    expect(groupNotifications(rows, now, 'America/Vancouver', 1)).toEqual({
      today: [today],
      thisWeek: [],
      earlier: [sunday, saturday],
    });
    expect(groupNotifications(rows, now, 'UTC', 1).today).toEqual([today, sunday]);
  });

  it('selects a kind without altering order and preserves all rows by default', () => {
    const rows = [row('follow', ''), row('reaction', ''), row('follow', '')];
    expect(filterNotifications(rows, 'all')).toBe(rows);
    expect(filterNotifications(rows, 'follow')).toEqual([rows[0], rows[2]]);
    expect(filterNotifications(rows, 'friend_done')).toEqual([]);
  });

  it('selects translated sentence keys with interpolations, even for one completion', () => {
    const input = { name: 'B', count: 1, title: 'Read' };
    expect(notificationSentence({ kind: 'follow', ...input })).toEqual({
      key: 'social.notifications.sentenceFollow',
      params: { name: 'B' },
    });
    expect(notificationSentence({ kind: 'reaction', ...input })).toEqual({
      key: 'social.notifications.sentenceReaction',
      params: { name: 'B', title: 'Read' },
    });
    expect(notificationSentence({ kind: 'friend_done', ...input })).toEqual({
      key: 'social.notifications.sentenceFriendDone',
      params: { name: 'B', count: 1 },
    });
  });

  it('lets an explicit per-person override win over either global setting', () => {
    const mutes = [
      { actorId: 'a', friendDone: true },
      { actorId: 'b', friendDone: false },
    ];
    expect(effectiveFriendDone(undefined, mutes, 'c')).toBe(false);
    expect(effectiveFriendDone(undefined, mutes, 'a')).toBe(true);
    const prefs = { ...DEFAULT_NOTIFICATION_PREFS, friendDone: true };
    expect(effectiveFriendDone(prefs, mutes, 'b')).toBe(false);
    expect(effectiveFriendDone(prefs, mutes, 'c')).toBe(true);
  });
});
