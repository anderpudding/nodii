import { describe, expect, it } from 'vitest';
import { shouldDeliverPush } from './push';

describe('shouldDeliverPush', () => {
  it.each([
    ['Asia/Seoul', '13:59', true],
    ['Asia/Seoul', '14:00', false],
    ['Asia/Seoul', '22:59', false],
    ['Asia/Seoul', '23:00', true],
    ['America/Vancouver', '06:59', true],
    ['America/Vancouver', '07:00', false],
    ['America/Vancouver', '15:59', false],
    ['America/Vancouver', '16:00', true],
  ])('applies quiet hours in %s at %s UTC', (timeZone, time, allowed) => {
    expect(
      shouldDeliverPush({
        kind: 'follow',
        now: new Date(`2026-01-15T${time}:00Z`),
        timeZone,
      }),
    ).toBe(allowed);
  });

  it('limits only friend completions until exactly three hours have passed', () => {
    const now = new Date('2026-01-15T12:00:00Z');
    const input = { now, timeZone: 'UTC', lastSentAt: '2026-01-15T09:00:01Z' };
    expect(shouldDeliverPush({ ...input, kind: 'friend_done' })).toBe(false);
    expect(shouldDeliverPush({ ...input, kind: 'reaction' })).toBe(true);
    expect(
      shouldDeliverPush({
        ...input,
        kind: 'friend_done',
        lastSentAt: '2026-01-15T09:00:00Z',
      }),
    ).toBe(true);
    expect(shouldDeliverPush({ ...input, kind: 'follow', timeZone: 'Invalid/Zone' })).toBe(false);
  });
});
