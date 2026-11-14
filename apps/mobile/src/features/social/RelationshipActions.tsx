import { Alert, Pressable, Text } from 'react-native';
import {
  relationshipErrorKey,
  useFollowMutation,
  useRelationshipPending,
  type NodiiClient,
} from '@nodii/api';
import { followButtonState, type FollowRelation } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { useToast } from '../../components/Toast';
import { profileStyles as s } from './Primitives';

/** SOC-11·12·60·61: 기존 iOS 확인 창으로 관계 변경 결과를 안내한다. */
export function confirmRelationship(
  title: string,
  description: string,
  action: string,
  onPress: () => void,
  danger = false,
) {
  Alert.alert(title, description, [
    { text: t('mobile.add.cancel'), style: 'cancel' },
    { text: action, style: danger ? 'destructive' : 'default', onPress },
  ]);
}

/** D25: 표시 크기와 별개로 누르는 영역은 44pt를 유지한다. */
export function SmallAction({
  label,
  size = 32,
  wide,
  width,
  secondary,
  disabled,
  onPress,
}: {
  label: string;
  size?: number;
  width?: number;
  wide?: boolean;
  secondary?: boolean;
  disabled?: boolean;
  onPress(): void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: m.height.touch,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed || disabled ? m.pressedOpacity : 1,
      })}
    >
      <Text
        style={[
          s.label,
          {
            lineHeight: size,
            paddingHorizontal: m.space.md,
            width: width ?? (wide ? 140 : undefined),
            textAlign: 'center',
            color: secondary ? colors.ink : colors.bg,
            backgroundColor: secondary ? colors.chip : colors.ink,
            borderRadius: m.radius.pill,
            overflow: 'hidden',
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** D25: 버튼 상태와 확인 창을 프로필·목록에서 공유한다. */
export function FollowButton({
  client,
  me,
  person,
  relation,
  size = 32,
  width,
}: {
  client: NodiiClient;
  me: string;
  person: { userId: string; nickname: string };
  relation?: FollowRelation;
  size?: number;
  width?: number;
}) {
  const toast = useToast();
  const mutation = useFollowMutation(client, me, person.userId);
  const pending = useRelationshipPending(me, person.userId);
  if (!relation) return null;
  const state = followButtonState(relation);
  const update = (next: boolean) =>
    mutation.mutate(next, {
      onError: (error) => toast(() => t(relationshipErrorKey(error, true))),
    });
  return (
    <SmallAction
      label={t(`social.follow.${state}`)}
      secondary={state === 'following'}
      size={size}
      width={width}
      wide={size === 36}
      disabled={pending}
      onPress={() => {
        if (state !== 'following') return update(true);
        confirmRelationship(
          t('social.follow.confirm', { nickname: person.nickname }),
          t('social.follow.explanation'),
          t('social.follow.unfollow'),
          () => update(false),
          true,
        );
      }}
    />
  );
}
