import { describe, expect, it } from 'vitest';
import {
  hexToHsv,
  hsvToHex,
  moveTodayPerson,
  normalizeHex,
  orderTodayPeople,
  shouldShowFirstPublishNotice,
  visibilityA11y,
  VISIBILITY_CHOICES,
} from './friends-day';

describe('goal visibility', () => {
  it('only offers the three v3 choices and describes each choice', () => {
    expect(VISIBILITY_CHOICES.map(visibilityA11y)).toEqual([
      'social.visibility.a11yFollowers',
      'social.visibility.a11yMutual',
      'social.visibility.a11yPrivate',
    ]);
    expect(visibilityA11y('public')).toBeUndefined();
  });
  it('only warns on the first publication of private records', () => {
    expect(shouldShowFirstPublishNotice('private', 'mutual', false)).toBe(true);
    expect(shouldShowFirstPublishNotice('private', 'followers', false)).toBe(true);
    expect(shouldShowFirstPublishNotice('private', 'private', false)).toBe(false);
    expect(shouldShowFirstPublishNotice('private', 'mutual', true)).toBe(false);
    expect(shouldShowFirstPublishNotice('followers', 'mutual', false)).toBe(false);
  });
});

describe('custom goal colors', () => {
  it.each(['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#FF00FF', '#254782', '#B19A67'])(
    'round trips %s',
    (color) => expect(hsvToHex(hexToHsv(color))).toBe(color),
  );
  it('accepts shorthand, rejects invalid input and wraps hue', () => {
    expect(normalizeHex(' aBf ')).toBe('#AABBFF');
    expect(normalizeHex('abcdef')).toBe('#ABCDEF');
    expect(normalizeHex('#QAABFF')).toBeNull();
    expect(hexToHsv('invalid')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hsvToHex({ h: -60, s: 2, v: 1 })).toBe('#FF00FF');
  });
});

describe('today people', () => {
  const person = (
    followeeId: string,
    todaySortKey: string,
    createdAt = '2026-11-13',
    showOnToday = true,
  ) => ({ followeeId, todaySortKey, createdAt, showOnToday });
  it('sorts both groups by key, date, then id', () => {
    const data = [
      person('c', 'a0'),
      person('x', 'a1', '2026-11-12', false),
      person('b', 'a0', '2026-11-12'),
      person('a', 'a0'),
      person('y', 'a0', '2026-11-13', false),
    ];
    const { shown, hidden } = orderTodayPeople(data);
    expect(shown.map((p) => p.followeeId)).toEqual(['b', 'a', 'c']);
    expect(hidden.map((p) => p.followeeId)).toEqual(['y', 'x']);
  });
  it('moves at both boundaries and between neighbors', () => {
    const list = ['a0', 'a1', 'a2', 'a3'].map((key) => person(key, key));
    expect(moveTodayPerson(list, 2, 0)! < 'a0').toBe(true);
    expect(moveTodayPerson(list, 0, 3)! > 'a3').toBe(true);
    const middle = moveTodayPerson(list, 0, 1)!;
    expect(middle > 'a1' && middle < 'a2').toBe(true);
    expect(moveTodayPerson(list, 0, 0)).toBeNull();
    expect(moveTodayPerson(list, -1, 0)).toBeNull();
    expect(moveTodayPerson(list, 0, 4)).toBeNull();
  });
  it('can cross a run of equal keys without generating an invalid interval', () => {
    const list = [person('a', 'a0'), person('b', 'a1'), person('c', 'a1'), person('d', 'a2')];
    const key = moveTodayPerson(list, 0, 1)!;
    expect(key > 'a1' && key < 'a2').toBe(true);
    expect(moveTodayPerson(list, 3, 2)! < 'a1').toBe(true);
  });
});
