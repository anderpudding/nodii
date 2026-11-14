import { compareSortKey, keyBetween } from './sort-key';
import type { DefaultVisibility } from './social';

export type GoalVisibility = DefaultVisibility | 'public';
export const VISIBILITY_CHOICES = ['followers', 'mutual', 'private'] as const;

const visibilityLabels = {
  followers: 'social.visibility.a11yFollowers',
  mutual: 'social.visibility.a11yMutual',
  private: 'social.visibility.a11yPrivate',
} as const;

/** SOC-24: v3에서 선택할 수 있는 공개 범위만 읽어 준다. */
export function visibilityA11y(visibility: GoalVisibility = 'private') {
  return visibility === 'public' ? undefined : visibilityLabels[visibility];
}

/** SOC-25: 기기에서 처음 비공개 기록을 공개하려 할 때 안내한다. */
export function shouldShowFirstPublishNotice(
  prev: GoalVisibility,
  next: DefaultVisibility,
  seen: boolean,
) {
  return !seen && prev === 'private' && next !== 'private';
}

export interface Hsv {
  h: number;
  s: number;
  v: number;
}

/** SOC-27: 직접 입력한 3자리·6자리 색을 하나의 저장 형식으로 바꾼다. */
export function normalizeHex(raw: string): string | null {
  const input = raw.trim().replace(/^#/, '').toUpperCase();
  if (/^[0-9A-F]{6}$/.test(input)) return '#' + input;
  if (/^[0-9A-F]{3}$/.test(input)) return '#' + [...input].map((digit) => digit.repeat(2)).join('');
  return null;
}

/** SOC-27: 선택기의 좌표를 저장할 목표 색으로 바꾼다. */
export function hsvToHex({ h, s, v }: Hsv): string {
  const hue = ((h % 360) + 360) % 360;
  const saturation = Math.max(0, Math.min(1, s));
  const value = Math.max(0, Math.min(1, v));
  return (
    '#' +
    [5, 3, 1]
      .map((n) => {
        const k = (n + hue / 60) % 6;
        const channel = value * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1)));
        return Math.round(channel * 255)
          .toString(16)
          .padStart(2, '0')
          .toUpperCase();
      })
      .join('')
  );
}

/** SOC-27: 입력한 HEX를 선택기 좌표와 동기화한다. */
export function hexToHsv(raw: string): Hsv {
  const hex = normalizeHex(raw) ?? '#000000';
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const v = Math.max(r, g, b);
  const delta = v - Math.min(r, g, b);
  const sector =
    delta === 0
      ? 0
      : v === r
        ? (g - b) / delta
        : v === g
          ? 2 + (b - r) / delta
          : 4 + (r - g) / delta;
  return { h: (sector * 60 + 360) % 360, s: v === 0 ? 0 : delta / v, v };
}

export interface TodayFollow {
  followeeId: string;
  showOnToday: boolean;
  todaySortKey: string;
  createdAt: string;
}

/** SOC-36: 동시 팔로우의 키가 같아도 두 앱에서 같은 순서가 나온다. */
export function orderTodayPeople<T extends TodayFollow>(follows: readonly T[]) {
  const list = [...follows].sort(
    (a, b) =>
      compareSortKey(a.todaySortKey, b.todaySortKey) ||
      compareSortKey(a.createdAt, b.createdAt) ||
      compareSortKey(a.followeeId, b.followeeId),
  );
  return { shown: list.filter((p) => p.showOnToday), hidden: list.filter((p) => !p.showOnToday) };
}

/** SOC-36: 옮긴 한 행만 수정하고 같은 키 안에는 삽입하지 않는다. */
export function moveTodayPerson(
  list: readonly TodayFollow[],
  from: number,
  to: number,
): string | null {
  const moving = list[from];
  if (!moving || !list[to] || from === to) return null;
  const others = list.filter((_, i) => i !== from);
  let index = to;
  while (
    others[index - 1] &&
    others[index] &&
    others[index - 1]?.todaySortKey === others[index]?.todaySortKey
  ) {
    index += from < to ? 1 : -1;
  }
  return keyBetween(others[index - 1]?.todaySortKey ?? null, others[index]?.todaySortKey ?? null);
}
