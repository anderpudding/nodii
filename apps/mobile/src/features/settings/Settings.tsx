import { useState, type ReactNode } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useGoals, useRoutines, useUpdateWeekStart, type NodiiClient } from '@nodii/api';
import type { Profile } from '@nodii/core';
import { getLocale, t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { saveLanguage, useLanguagePreference } from '../../../lib/language-preference';
import { saveTheme, useThemePreference } from '../../../lib/theme-preference';
import { metrics as m, useTheme } from '../../../lib/theme';
import { mobileLinks } from '../../../lib/links';
import { ManagementScreen } from '../../components/ManagementScreen';
import { useToast } from '../../components/Toast';
import { RoutineOption } from '../routines/RoutineOption';
import { RoutineList } from '../routines/RoutineList';
import { Goals } from '../goals/Goals';
import { useUIStore } from '../../stores/ui';
import { AccountDelete } from './AccountDelete';
import { SearchableSwitch, type SocialSettings } from '../social/ProfilePrivacy';
import { settingsStyles as s } from './styles';

/** SET-01/02/07: 보기·계정·관리·정보를 네 카드로 묶어 같은 하루의 설정을 제공한다. */
export function Settings({
  client,
  profile,
  email,
  onLogout,
  loggingOut,
  onAccountDeleted,
  onClose,
  social,
}: {
  client: NodiiClient;
  profile: Profile;
  email: string;
  onLogout(): void;
  loggingOut: boolean;
  onAccountDeleted(): Promise<void>;
  onClose(): void;
  social?: SocialSettings;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const [page, setPage] = useState<'goals' | 'routines' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const language = useLanguagePreference((state) => state.preference);
  const [themeSaving, setThemeSaving] = useState(false);
  const preference = useThemePreference((state) => state.preference);
  const week = useUpdateWeekStart(client, profile.id, {
    onError: () => toast(() => t('todo.save.failed')),
  });
  const goals = useGoals(client, profile.id);
  const routines = useRoutines(client, profile.id);
  const { selectedDate, today } = useUIStore();
  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      toast(() => t('settings.link.failed'));
    }
  }
  function group(title: string, children: ReactNode) {
    return (
      <View style={s.group}>
        <Text accessibilityRole="header" style={[s.label, { color: colors.ink2 }]}>
          {title}
        </Text>
        <View style={[s.card, { backgroundColor: colors.chip, borderColor: colors.line }]}>
          {/* 마지막 줄의 구분선은 카드 모서리 안으로 숨겨 줄 사이에만 선이 남게 한다. */}
          <View style={s.rows}>{children}</View>
        </View>
      </View>
    );
  }
  function row(label: string, value: ReactNode) {
    return (
      <View style={[s.row, s.horizontal, s.wrap, { borderBottomColor: colors.line }]}>
        <Text style={[s.body, { color: colors.ink }]}>{label}</Text>
        {value}
      </View>
    );
  }
  return (
    <ManagementScreen
      title={t('settings.title')}
      back={social ? `‹ ${t('tabs.profile')}` : t('settings.backToday')}
      onClose={onClose}
      testID="settings-screen"
    >
      {group(
        t('settings.account'),
        <>
          {row(
            t('auth.email'),
            <Text selectable style={[s.body, { color: colors.ink2, flexShrink: 1 }]}>
              {email}
            </Text>,
          )}
          {social && (
            <RoutineOption
              inline
              descriptionBelow
              label={t('settings.account.handle')}
              description={t('settings.account.handleHelp')}
              onPress={social.onHandle}
            >
              <Text style={[s.body, { color: colors.ink }]}>{t('settings.account.handle')}</Text>
              <Text style={[s.body, { color: colors.muted }]}>
                {t('social.handle.display', { handle: social.profile.handle })} ›
              </Text>
            </RoutineOption>
          )}
          <RoutineOption
            inline
            descriptionBelow
            label={t('auth.logout')}
            description={t('settings.logout.description')}
            disabled={loggingOut}
            onPress={onLogout}
          />
        </>,
      )}
      {social &&
        group(
          t('settings.privacy'),
          <>
            <RoutineOption
              inline
              label={t('settings.privacy.visibility')}
              onPress={social.onVisibility}
            >
              <Text style={[s.body, { color: colors.ink, flex: 1 }]}>
                {t('settings.privacy.visibility')}
              </Text>
              <Text style={[s.supporting, { color: colors.muted }]}>
                {t(`settings.privacy.${profile.defaultVisibility ?? 'private'}`)} ›
              </Text>
            </RoutineOption>
            <SearchableSwitch client={client} profile={social.profile} />
          </>,
        )}
      {group(
        t('settings.view'),
        <>
          {row(
            t('settings.weekStart'),
            <Segment
              label={t('settings.weekStart')}
              value={profile.weekStart}
              options={([0, 1] as const).map((value) => ({
                value,
                label: t(value ? 'settings.monday' : 'settings.sunday'),
              }))}
              disabled={!online || week.isPending}
              onChange={(value) => week.mutate(value)}
            />,
          )}
          {!online && (
            <Text style={[s.supporting, s.note, { color: colors.muted }]}>
              {t('sync.writeDisabled')}
            </Text>
          )}
          {row(
            t('settings.theme'),
            <Segment
              label={t('settings.theme')}
              value={preference}
              options={(['system', 'light', 'dark'] as const).map((value) => ({
                value,
                label: t(`settings.theme.${value}`),
              }))}
              disabled={themeSaving}
              onChange={(value) => {
                setThemeSaving(true);
                void saveTheme(value)
                  .catch(() => toast(() => t('settings.theme.failed')))
                  .finally(() => setThemeSaving(false));
              }}
            />,
          )}
          {row(
            t('settings.language'),
            <Segment
              label={t('settings.language')}
              value={language}
              options={(['system', 'ko', 'en'] as const).map((value) => ({
                value,
                label: t(`settings.language.${value}`),
              }))}
              disabled={languageSaving}
              onChange={(value) => {
                setLanguageSaving(true);
                void saveLanguage(value)
                  .catch(() => toast(() => t('settings.language.saveFailed')))
                  .finally(() => setLanguageSaving(false));
              }}
            />,
          )}
        </>,
      )}
      {group(
        t('settings.management'),
        <>
          <RoutineOption
            inline
            label={t('goal.manage')}
            description={t('settings.management.count', {
              count: (goals.data ?? []).filter((goal) => !goal.archivedAt).length,
            })}
            onPress={() => setPage('goals')}
          />
          <RoutineOption
            inline
            label={t('routine.manage')}
            description={t('settings.management.count', {
              count: (routines.data ?? []).filter(
                (routine) => !routine.endDate || routine.endDate >= today,
              ).length,
            })}
            onPress={() => setPage('routines')}
          />
        </>,
      )}
      {group(
        t('settings.info'),
        <>
          {row(
            t('settings.version'),
            <Text style={[s.body, { color: colors.ink2 }]}>
              {Constants.expoConfig?.version ?? '0.1.0'} (iOS)
            </Text>,
          )}
          {mobileLinks.map(({ label, url }) => (
            <RoutineOption
              key={label}
              inline
              label={t(label)}
              description={!url ? t('settings.link.pending') : undefined}
              disabled={!url}
              onPress={() => void openLink(url)}
            />
          ))}
          <RoutineOption
            inline
            descriptionBelow
            label={t('settings.delete')}
            description={t(social ? 'settings.delete.socialSummary' : 'settings.delete.summary')}
            danger
            disabled={!online || loggingOut}
            onPress={() => setDeleting(true)}
          />
        </>,
      )}
      {page === 'goals' && (
        <Goals client={client} userId={profile.id} onClose={() => setPage(null)} />
      )}
      {page === 'routines' && (
        <RoutineList
          client={client}
          userId={profile.id}
          backLabel={t('settings.back')}
          date={selectedDate}
          today={today}
          weekStart={profile.weekStart}
          timeZone={profile.timezone}
          onClose={() => setPage(null)}
        />
      )}
      {deleting && (
        <AccountDelete
          client={client}
          userId={profile.id}
          onDeleted={onAccountDeleted}
          onClose={() => setDeleting(false)}
        />
      )}
    </ManagementScreen>
  );
}

/** SET-02/05: 시안처럼 줄 오른쪽에 붙는 알약 세그먼트. 보이는 높이는 36, 누르는 영역은 44를 유지한다. */
function Segment<T extends string | number>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  disabled: boolean;
  onChange(value: T): void;
}) {
  const { colors } = useTheme();
  const english = getLocale() === 'en';
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={[s.segment, { backgroundColor: colors.bg, opacity: disabled ? 0.5 : 1 }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ disabled, selected, checked: selected }}
            disabled={disabled}
            hitSlop={(m.height.touch - m.height.chip) / 2}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={({ pressed }) => [
              s.segmentOption,
              english && { flexShrink: 1 },
              {
                backgroundColor: selected ? colors.ink : 'transparent',
                opacity: pressed ? m.pressedOpacity : 1,
              },
            ]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit={english}
              style={[s.segmentLabel, { color: selected ? colors.bg : colors.ink2 }]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
