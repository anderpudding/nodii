import { useReactionToggle, type NodiiClient } from '@nodii/api';
import { goalInk, HEART_PATH, type ReactionTarget } from '@nodii/core';
import { t } from '@nodii/i18n';
import { Pressable } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { metrics as m, useTheme } from '../../../lib/theme';
import { useToast } from '../../components/Toast';

interface HeartProps {
  client: NodiiClient;
  me: string;
  target: ReactionTarget;
  title: string;
  color: string;
  reactionId?: string;
  ready: boolean;
  compact?: boolean;
}

/** SOC-40: 하트와 줄 신고에 서로 다른 터치 영역을 둔다. */
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
  const { colors, isDark } = useTheme();
  const toast = useToast();
  const toggle = useReactionToggle(client, me, target, () =>
    toast(() => t('social.reaction.failed')),
  );
  const selected = !!reactionId;
  const ink = selected ? goalInk(color, colors.chip, isDark) : colors.muted;
  const size = compact ? 18 : 20;
  const touch = compact ? 36 : 40;
  return (
    <Pressable
      accessibilityRole="togglebutton"
      accessibilityLabel={
        selected ? t('social.reaction.unlike') : t('social.reaction.like', { title })
      }
      accessibilityState={{ checked: selected, disabled: !ready || toggle.isPending }}
      onPress={() => {
        if (ready) toggle.toggle(reactionId);
      }}
      style={({ pressed }) => ({
        width: touch,
        height: touch,
        borderRadius: m.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? m.pressedOpacity : 1,
      })}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Path
          d={HEART_PATH}
          fill={selected ? ink : 'none'}
          stroke={ink}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  );
}
