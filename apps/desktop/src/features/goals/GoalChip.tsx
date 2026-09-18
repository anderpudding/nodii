import { checkColor, goalInk, goalTint, type Goal } from '@nodii/core';
import type { CSSProperties } from 'react';

/** CSS color-mix 대신 두 테마의 목표 색을 순수 함수로 미리 계산한다. */
export function goalStyle(color: string, surface = false): CSSProperties {
  return {
    '--goal-color': color,
    '--goal-check': checkColor(color),
    '--goal-tint-light': goalTint(color, '#FFFFFF', 0.14),
    '--goal-ink-light': goalInk(color, '#FFFFFF', false),
    '--goal-tint-dark': goalTint(color, surface ? '#1D1F23' : '#131417', 0.22),
    '--goal-ink-dark': goalInk(color, surface ? '#1D1F23' : '#131417', true),
  } as CSSProperties;
}
/** 활성 목표 이름표 자체를 추가 버튼으로 쓴다 (TODO-01, I3). */
export function GoalChip({
  goal,
  onAdd,
  disabled,
  surface,
}: {
  goal: Goal;
  onAdd?: () => void;
  disabled?: boolean;
  surface?: boolean;
}) {
  const className = `goal-chip${goal.archivedAt ? ' goal-chip-archived' : ''}`;
  return onAdd ? (
    <button
      type="button"
      className={className}
      style={goalStyle(goal.color, surface)}
      onClick={onAdd}
      disabled={disabled}
      aria-label={`${goal.name}에 할 일 추가`}
    >
      {goal.name}
      <span aria-hidden="true">＋</span>
    </button>
  ) : (
    <span className={className} style={goalStyle(goal.color, surface)}>
      {goal.name}
    </span>
  );
}
