import { useReactionToggle, type NodiiClient } from '@nodii/api';
import { HEART_PATH, type ReactionTarget } from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { goalStyle } from '../goals/GoalChip';

export interface HeartProps {
  client: NodiiClient;
  me: string;
  target: ReactionTarget;
  title: string;
  color: string;
  reactionId?: string;
  ready: boolean;
  compact?: boolean;
}

/** SOC-40: 좋아요만 조작하며 친구 항목 자체는 변경하지 않는다. */
export function HeartButton({
  client,
  me,
  target,
  title,
  color,
  reactionId,
  ready,
  compact,
}: HeartProps) {
  const toggle = useReactionToggle(client, me, target, () =>
    toast.error(t('social.reaction.failed')),
  );
  const pressed = !!reactionId;
  return (
    <button
      type="button"
      className="social-heart"
      data-compact={compact || undefined}
      style={goalStyle(color)}
      aria-label={pressed ? t('social.reaction.unlike') : t('social.reaction.like', { title })}
      aria-pressed={pressed}
      aria-disabled={!ready || toggle.isPending}
      onContextMenu={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        if (ready) toggle.toggle(reactionId);
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill={pressed ? 'currentColor' : 'none'}>
        <path d={HEART_PATH} stroke="currentColor" strokeWidth={2} strokeLinejoin="round" />
      </svg>
    </button>
  );
}
