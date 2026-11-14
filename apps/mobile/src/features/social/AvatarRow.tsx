import { Pressable, ScrollView, Text, View } from 'react-native';
import { avatarUrl, type NodiiClient, type TodayPerson } from '@nodii/api';
import type { SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Avatar } from './Primitives';

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
  const cell = { width: 60, alignItems: 'center' as const, gap: 6 };
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: m.space.lg,
        paddingVertical: m.space.md,
        gap: m.space.sm,
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
              size={52}
              selected={viewing}
              photoUrl={avatar ? avatarUrl(client, avatar, 160) : undefined}
            />
            <Text
              numberOfLines={1}
              style={{
                color: viewing ? colors.ink : colors.muted,
                fontSize: 12,
                fontWeight: viewing ? '800' : '600',
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
            width: 52,
            height: 52,
            borderRadius: 26,
            borderWidth: m.todayRing,
            borderColor: colors.line2,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: colors.ink2, fontSize: 22 }}>≡</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: '600' }}>
          {t('social.today.list')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
