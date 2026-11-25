import { Pressable, ScrollView, Text, View } from 'react-native';
import { avatarUrl, type NodiiClient, type TodayPerson } from '@nodii/api';
import type { SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import Svg, { Path } from 'react-native-svg';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Avatar } from './Primitives';

const avatarSize = 64;

/** SOC-30: 선택한 사람과 마지막 목록 버튼이 같은 가로 줄을 공유한다. */
export function AvatarRow({
  client,
  me,
  people,
  selected,
  onSelect,
  onManage,
}: {
  client: NodiiClient;
  me?: SocialProfile;
  people: readonly TodayPerson[];
  selected: string | null;
  onSelect(id: string | null): void;
  onManage(): void;
}) {
  const { colors } = useTheme();
  const profiles = [
    { id: null, name: t('social.today.me'), avatar: me?.avatarPath },
    ...people.map(({ profile }) => ({
      id: profile.userId,
      name: profile.nickname,
      avatar: profile.avatarPath,
    })),
  ];
  const cell = { width: 74, alignItems: 'center' as const, gap: 6 };
  return (
    <ScrollView
      testID="today-avatar-row"
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{
        paddingHorizontal: m.space.lg,
        // 스크롤 영역이 자르는 범위 안에 4.5pt 선택 링과 위 여백 2pt를 둔다.
        paddingTop: 4.5 + 2,
        paddingBottom: m.space.md,
        gap: 10,
      }}
    >
      {profiles.map(({ id, name, avatar }) => {
        const viewing = id === selected;
        const label =
          id === null
            ? t(viewing ? 'social.today.mineSelected' : 'social.today.mine')
            : t(viewing ? 'social.today.personSelected' : 'social.today.person', { name });
        return (
          <Pressable
            key={id ?? 'me'}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: viewing }}
            style={cell}
            onPress={() => onSelect(id)}
          >
            <Avatar
              label={name}
              size={avatarSize}
              selected={viewing}
              photoUrl={avatar ? avatarUrl(client, avatar, 160) : undefined}
            />
            <Text
              numberOfLines={1}
              style={{
                color: viewing ? colors.ink : colors.muted,
                fontSize: m.type.supporting,
                fontFamily: viewing ? m.fontExtraBold : m.fontSemiBold,
              }}
            >
              {name}
            </Text>
          </Pressable>
        );
      })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('social.today.list')}
        onPress={onManage}
        style={cell}
      >
        <View
          style={{
            width: avatarSize,
            height: avatarSize,
            borderRadius: m.radius.pill,
            borderWidth: m.todayRing,
            borderColor: colors.line2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Svg width={24} height={24} viewBox="0 0 24 24" accessible={false}>
            <Path d="M5 7h14M5 12h14M5 17h14" stroke={colors.ink2} strokeWidth={2} />
          </Svg>
        </View>
        <Text
          style={{ color: colors.muted, fontSize: m.type.supporting, fontFamily: m.fontSemiBold }}
        >
          {t('social.today.list')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
