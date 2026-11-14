import { showPublishNotice } from '../goals/publish-notice';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useUpdateDefaultVisibility, useUpdateSocialProfile, type NodiiClient } from '@nodii/api';
import type { DefaultVisibility, SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { useToast } from '../../components/Toast';
import { ProfileNav, SocialIcon, profileStyles as s } from './Primitives';

export interface SocialSettings {
  profile: SocialProfile;
  onHandle(): void;
  onVisibility(): void;
  onBlocked(): void;
  onFriendDone?(): void;
}

/** SOC-06: 기존 설정 그룹 안에서 검색 허용을 즉시 바꾸고 실패 시 복원한다. */
export function SearchableSwitch({
  client,
  profile,
}: {
  client: NodiiClient;
  profile: SocialProfile;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const update = useUpdateSocialProfile(client, profile.userId);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={t('settings.privacy.searchable')}
      accessibilityState={{ checked: profile.searchable, disabled: update.isPending }}
      disabled={update.isPending}
      onPress={() =>
        update.mutate(
          { searchable: !profile.searchable },
          { onError: () => toast(() => t('social.save.failed')) },
        )
      }
      style={[
        s.row,
        {
          minHeight: m.height.menu,
          padding: m.space.lg,
          borderTopWidth: m.todayRing,
          borderTopColor: colors.bg,
        },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[s.body, { color: colors.ink }]}>{t('settings.privacy.searchable')}</Text>
        <Text style={[s.support, { color: colors.muted }]}>
          {t('settings.privacy.searchableHelp')}
        </Text>
      </View>
      <ProfileSwitch checked={profile.searchable} />
    </Pressable>
  );
}

/** SOC-06·62: 두 스위치에 같은 40pt 트랙을 사용한다. */
export function ProfileSwitch({ checked }: { checked: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 24,
        padding: 2,
        backgroundColor: checked ? colors.ink : colors.box,
        alignItems: checked ? 'flex-end' : 'flex-start',
        borderRadius: m.radius.pill,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 3px rgba(17,19,24,0.25)',
        }}
      />
    </View>
  );
}

/** SOC-28: 세 단계 기본값 중 하나를 선택한다. */
export function DefaultVisibilityScreen({
  client,
  userId,
  visibility,
  onBack,
}: {
  client: NodiiClient;
  userId: string;
  visibility: DefaultVisibility;
  onBack(): void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const update = useUpdateDefaultVisibility(client, userId);
  return (
    <>
      <ProfileNav back={`‹ ${t('settings.title')}`} onBack={onBack} />
      <ScrollView contentContainerStyle={[s.page, { gap: m.space.md, paddingBottom: m.space.lg }]}>
        <Text accessibilityRole="header" style={[s.title, { color: colors.ink }]}>
          {t('settings.privacy.visibility')}
        </Text>
        <Text style={[s.support, { color: colors.muted }]}>
          {t('settings.privacy.visibilityHelp')}
        </Text>
        <View style={[s.card, { backgroundColor: colors.chip }]} accessibilityRole="radiogroup">
          {(['private', 'mutual', 'followers'] as const).map((value, index) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={t(`settings.privacy.${value}`)}
              accessibilityState={{ checked: visibility === value, disabled: update.isPending }}
              disabled={update.isPending}
              onPress={() => {
                showPublishNotice(visibility, value, toast);
                update.mutate(value, { onError: () => toast(() => t('social.save.failed')) });
              }}
              style={[
                s.row,
                {
                  minHeight: m.height.menu,
                  padding: m.space.md,
                  borderTopWidth: index ? m.todayRing : 0,
                  borderTopColor: colors.bg,
                },
              ]}
            >
              <View style={{ width: 40, alignItems: 'center' }}>
                <SocialIcon
                  color={colors.ink2}
                  name={value === 'private' ? 'lock' : value === 'mutual' ? 'mutual' : 'profile'}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.body, { color: colors.ink }]}>
                  {t(`settings.privacy.${value}`)}
                </Text>
                <Text style={[s.support, { color: colors.muted }]}>
                  {t(`settings.privacy.${value}Help`)}
                </Text>
              </View>
              {visibility === value && <SocialIcon name="check" color={colors.ink} />}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </>
  );
}
