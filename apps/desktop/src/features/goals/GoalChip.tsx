import { t } from '@nodii/i18n';
import { useConnectivity } from '../../lib/connectivity';
import { toast } from 'sonner';
import { checkColor, goalInk, visibilityA11y, type Goal } from '@nodii/core';
import { useContext, type CSSProperties } from 'react';
import { GoalMark } from './GoalMark';
import { VisibilityContext } from '../social/VisibilityContext';

/** CSS color-mix 대신 두 테마의 목표 색을 순수 함수로 미리 계산한다. */
export function goalStyle(color: string, surface = false): CSSProperties {
  return {
    '--goal-color': color,
    '--goal-check': checkColor(color),
    '--goal-ink-light': goalInk(color, surface ? '#FFFFFF' : '#F2F3F6', false),
    '--goal-ink-dark': goalInk(color, surface ? '#0F1013' : '#1E2026', true),
  } as CSSProperties;
}
/** 활성 목표 이름표 자체를 추가 버튼으로 쓴다 (TODO-01, I3). */
export function GoalChip({
  goal,
  onAdd,
  disabled,
  surface,
  friend = false,
}: {
  goal: Goal;
  onAdd?: () => void;
  disabled?: boolean;
  surface?: boolean;
  friend?: boolean;
}) {
  const online = useConnectivity();
  const visibility =
    useContext(VisibilityContext) && !friend ? (goal.visibility ?? 'private') : undefined;
  const label = visibility && visibilityA11y(visibility);
  const describe = (name: string) =>
    label ? t('social.visibility.withName', { name, visibility: t(label) }) : name;
  const className = `goal-chip${surface ? ' goal-chip-surface' : ''}${goal.archivedAt ? ' goal-chip-archived' : ''}`;
  return onAdd ? (
    <button
      type="button"
      className={className}
      style={goalStyle(goal.color, surface)}
      aria-disabled={!online || undefined}
      onClick={() => (online ? onAdd() : toast.error(t('sync.writeDisabled')))}
      disabled={disabled}
      aria-label={describe(t('mobile.goal.add', { name: goal.name }))}
    >
      <GoalMark color={goal.color} visibility={visibility} friend={friend} />
      {goal.name}
      <span className="goal-chip-add" aria-hidden="true">
        ＋
      </span>
    </button>
  ) : (
    <span className={className} style={goalStyle(goal.color, surface)}>
      {label && <span className="sr-only">{t(label)} </span>}
      <GoalMark color={goal.color} visibility={visibility} friend={friend} />
      {goal.name}
    </span>
  );
}
