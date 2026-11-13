import { Animated, Text, View } from 'react-native';
import { avatarUrl, type NodiiClient } from '@nodii/api';
import type { SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Avatar, profileStyles as s } from './Primitives';

/** D25: 펼친 머리와 접힌 머리가 같은 프로필 데이터를 사용한다. */
export function ProfileHeader({
  client,
  profile,
  compact,
  opacity,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  compact?: boolean;
  opacity?: Animated.AnimatedInterpolation<number>;
}) {
  const { colors } = useTheme();
  return (
    <Animated.View
      style={{
        opacity,
        flexDirection: compact ? 'row' : 'column',
        gap: compact ? m.space.md : m.space.sm,
        alignItems: 'center',
        paddingHorizontal: m.space.lg,
        paddingVertical: m.space.sm,
      }}
    >
      <Avatar
        size={compact ? 44 : 84}
        label={profile.nickname}
        photoUrl={
          profile.avatarPath
            ? avatarUrl(client, profile.avatarPath, compact ? 160 : 480)
            : undefined
        }
      />
      <View
        style={{ flexShrink: 1, alignItems: compact ? 'flex-start' : 'center', gap: m.space.xs }}
      >
        <Text
          accessibilityRole="header"
          numberOfLines={compact ? 1 : 2}
          style={[
            s.heading,
            {
              fontSize: compact ? 17 : 22,
              color: colors.ink,
              textAlign: compact ? 'left' : 'center',
            },
          ]}
        >
          {profile.nickname}
        </Text>
        <Text style={[s.support, { fontSize: compact ? 13 : 14, color: colors.muted }]}>
          {t('social.handle.display', { handle: profile.handle })}
        </Text>
        {!compact && !!profile.bio && (
          <Text
            numberOfLines={2}
            style={[
              s.support,
              { color: colors.ink2, fontSize: 14, textAlign: 'center', marginTop: m.space.xs },
            ]}
          >
            {profile.bio}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
