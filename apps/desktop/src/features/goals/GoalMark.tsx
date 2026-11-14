import { type CSSProperties } from 'react';
import { goalInk, goalVisibilityPaths, type GoalVisibility } from '@nodii/core';

/** SOC-24: 목표 색 점을 같은 위치의 공개 범위 아이콘으로 바꾼다. */
export function GoalMark({
  color,
  visibility,
  size = 10,
  friend = false,
  selected = false,
}: {
  color: string;
  visibility?: GoalVisibility;
  size?: number;
  friend?: boolean;
  selected?: boolean;
}) {
  const icon =
    !friend && (visibility === 'mutual' || visibility === 'followers') ? visibility : null;
  if (!icon)
    return (
      <span
        data-goal-mark="dot"
        aria-hidden="true"
        className="goal-dot"
        style={{ width: size, height: size, backgroundColor: color }}
      />
    );
  const width = size * (icon === 'mutual' ? 1.7 : 1.6);
  return (
    <svg
      data-goal-mark={icon}
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={width}
      height={width}
      style={
        {
          flex: 'none',
          color: selected ? 'var(--color-bg)' : 'var(--goal-mark-ink, var(--goal-mark-light))',
          '--goal-mark-light': goalInk(color, '#F2F3F6', false),
          '--goal-mark-dark': goalInk(color, '#1E2026', true),
        } as CSSProperties
      }
      fill="currentColor"
    >
      <path d={goalVisibilityPaths[icon]} />
    </svg>
  );
}
