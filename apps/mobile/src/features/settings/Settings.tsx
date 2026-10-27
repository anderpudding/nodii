import { useState, type ReactNode } from 'react';
import { Linking, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useGoals, useRoutines, useUpdateWeekStart, type NodiiClient } from '@nodii/api';
import type { Profile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { saveTheme, useThemePreference } from '../../../lib/theme-preference';
import { useTheme } from '../../../lib/theme';
import { mobileLinks } from '../../../lib/links';
import { ManagementScreen } from '../../components/ManagementScreen';
import { useToast } from '../../components/Toast';
import { RoutineOption } from '../routines/RoutineOption';
import { RoutineList } from '../routines/RoutineList';
import { Goals } from '../goals/Goals';
import { useUIStore } from '../../stores/ui';
import { AccountDelete } from './AccountDelete';
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
}: {
  client: NodiiClient;
  profile: Profile;
  email: string;
  onLogout(): void;
  loggingOut: boolean;
  onAccountDeleted(): Promise<void>;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const [page, setPage] = useState<'goals' | 'routines' | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [themeSaving, setThemeSaving] = useState(false);
  const preference = useThemePreference((state) => state.preference);
  const week = useUpdateWeekStart(client, profile.id, {
    onError: () => toast(t('todo.save.failed')),
  });
  const goals = useGoals(client);
  const routines = useRoutines(client);
  const { selectedDate, today } = useUIStore();
  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      toast(t('settings.link.failed'));
    }
  }
  function group(title: string, children: ReactNode) {
    return (
      <View style={s.group}>
        <Text accessibilityRole="header" style={[s.label, { color: colors.ink2 }]}>
          {title}
        </Text>
        <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          {children}
        </View>
      </View>
    );
  }
  function row(label: string, value: ReactNode) {
    return (
      <View style={[s.row, { borderBottomColor: colors.line }]}>
        <Text style={[s.body, { color: colors.ink }]}>{label}</Text>
        {value}
      </View>
    );
  }
  return (
    <ManagementScreen
      title={t('settings.title')}
      back={t('settings.backToday')}
      onClose={onClose}
      testID="settings-screen"
    >
      {group(
        t('settings.account'),
        <>
          {row(
            t('auth.email'),
            <Text selectable style={[s.supporting, { color: colors.ink2 }]}>
              {email}
            </Text>,
          )}
          <RoutineOption
            inline
            label={t('auth.logout')}
            description={t('settings.logout.description')}
            disabled={loggingOut}
            onPress={onLogout}
          />
        </>,
      )}
      {group(
        t('settings.view'),
        <>
          {row(
            t('settings.weekStart'),
            <View style={[s.segment, { backgroundColor: colors.bg }]}>
              {([0, 1] as const).map((value) => (
                <RoutineOption
                  key={value}
                  segment
                  label={t(value ? 'settings.monday' : 'settings.sunday')}
                  selected={profile.weekStart === value}
                  disabled={!online || week.isPending}
                  onPress={() => week.mutate(value)}
                />
              ))}
            </View>,
          )}
          {!online && (
            <Text style={[s.supporting, { color: colors.muted }]}>{t('sync.writeDisabled')}</Text>
          )}
          {row(
            t('settings.theme'),
            <View style={[s.segment, { backgroundColor: colors.bg }]}>
              {(['system', 'light', 'dark'] as const).map((value) => (
                <RoutineOption
                  key={value}
                  segment
                  label={t(`settings.theme.${value}`)}
                  selected={preference === value}
                  disabled={themeSaving}
                  onPress={() => {
                    setThemeSaving(true);
                    void saveTheme(value)
                      .catch(() => toast(t('settings.theme.failed')))
                      .finally(() => setThemeSaving(false));
                  }}
                />
              ))}
            </View>,
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
            <Text style={[s.supporting, { color: colors.ink2 }]}>
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
            label={t('settings.delete')}
            description={t('settings.delete.summary')}
            danger
            disabled={!online || loggingOut}
            onPress={() => setDeleting(true)}
          />
        </>,
      )}
      {page === 'goals' && <Goals client={client} onClose={() => setPage(null)} />}
      {page === 'routines' && (
        <RoutineList
          client={client}
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
          onDeleted={onAccountDeleted}
          onClose={() => setDeleting(false)}
        />
      )}
    </ManagementScreen>
  );
}
