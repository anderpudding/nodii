import { useState } from 'react';
import { Text, View } from 'react-native';
import { avatarUrl, type NodiiClient } from '@nodii/api';
import type { FollowRelation, SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Avatar, profileStyles as s } from './Primitives';
import { FollowButton } from './RelationshipActions';

export const collapseDistance = 120;
const blend = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** D25: 같은 사진, 닉네임, 버튼이 펼친 자리에서 접힌 자리로 이동한다. */
export function PersonDayHeader({
  client,
  me,
  person,
  relation,
  progress,
  expandedHeight,
}: {
  client: NodiiClient;
  me: string;
  person: SocialProfile;
  relation?: FollowRelation;
  progress: number;
  expandedHeight: number;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const avatarSize = blend(84, 44, progress);
  const compact = progress >= 0.5;
  const widthOfName = blend(
    width - 2 * m.space.lg,
    Math.max(0, width - 2 * m.space.lg - 44 - 140 - 2 * m.space.md),
    progress,
  );
  const height = blend(expandedHeight, 64, progress);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{
        position: 'absolute',
        zIndex: 1,
        top: 0,
        left: 0,
        right: 0,
        height,
        backgroundColor: colors.bg,
        overflow: 'hidden',
        borderBottomWidth: progress === 1 ? m.border : 0,
        borderColor: colors.line,
      }}
    >
      <View
        style={{
          position: 'absolute',
          left: blend((width - 84) / 2, m.space.lg, progress),
          top: blend(6, 10, progress),
        }}
      >
        <Avatar
          label={person.nickname}
          size={avatarSize}
          photoUrl={person.avatarPath ? avatarUrl(client, person.avatarPath, 480) : undefined}
        />
      </View>
      <View
        style={{
          position: 'absolute',
          left: blend(m.space.lg, m.space.lg + 44 + m.space.md, progress),
          top: blend(100, 10, progress),
          width: Math.max(0, widthOfName),
          alignItems: compact ? 'flex-start' : 'center',
        }}
      >
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[s.heading, { fontSize: blend(22, 17, progress), color: colors.ink }]}
        >
          {person.nickname}
        </Text>
        <Text
          numberOfLines={1}
          style={[s.support, { fontSize: blend(14, 13, progress), color: colors.muted }]}
        >
          {t('social.handle.display', { handle: person.handle })}
        </Text>
      </View>
      {person.bio && progress < 1 && (
        <Text
          numberOfLines={2}
          accessibilityElementsHidden={compact}
          style={[
            s.support,
            {
              position: 'absolute',
              left: m.space.lg,
              right: m.space.lg,
              top: 150,
              opacity: 1 - progress,
              textAlign: 'center',
              color: colors.ink2,
              fontSize: 14,
            },
          ]}
        >
          {person.bio}
        </Text>
      )}
      <View
        style={{
          position: 'absolute',
          top: blend(expandedHeight - 48, 10, progress),
          right: blend((width - 140) / 2, m.space.lg, progress),
          alignItems: 'flex-end',
        }}
      >
        <FollowButton
          client={client}
          me={me}
          person={person}
          relation={relation}
          size={blend(36, 32, progress)}
          width={blend(140, 76, progress)}
        />
      </View>
    </View>
  );
}
