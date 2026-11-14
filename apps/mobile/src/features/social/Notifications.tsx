import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useNotificationPrefs, useNotifications, useRelations, type NodiiClient } from '@nodii/api';
import {
  filterNotifications,
  groupNotifications,
  NOTIFICATION_FILTERS,
  NOTIFICATION_SECTIONS,
  type NotificationFilter,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { profileStyles as s, SocialIcon } from './Primitives';
import { onSocialForeground } from './invite-receiver';
import { NotificationRow } from './NotificationRow';
import { SmallAction } from './RelationshipActions';

const promptKey = 'nodii:friend-completion-prompt-dismissed';

interface Props {
  client: NodiiClient;
  me: string;
  timezone: string;
  weekStart: 0 | 1;
  following: boolean;
  bottom: number;
  onPerson(id: string): void;
  onToday(date: string): void;
  onSettings(): void;
}

/** SOC-50·56: 당겨서 새로 고칠 수 있는 종류별 알림 받는 곳이다. */
export function Notifications({
  client,
  me,
  timezone,
  weekStart,
  following,
  bottom,
  onPerson,
  onToday,
  onSettings,
}: Props) {
  const { colors } = useTheme();
  const query = useNotifications(client, me, onSocialForeground);
  const prefs = useNotificationPrefs(client, me);
  const [kind, setKind] = useState<NotificationFilter>('all');
  const [now, setNow] = useState(() => new Date());
  const [dismissed, setDismissed] = useState<boolean>();
  const rows = query.data ?? [];
  const relations = useRelations(
    client,
    me,
    rows.filter((row) => row.kind === 'follow' && row.actor).map((row) => row.actorId),
  );
  const visible = filterNotifications(rows, kind);
  const groups = groupNotifications(visible, now, timezone, weekStart);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(promptKey)
      .then((value) => {
        if (active) setDismissed(value === '1');
      })
      .catch(() => {
        if (active) setDismissed(false);
      });
    const timer = setInterval(() => setNow(new Date()), 60_000);
    const foreground = onSocialForeground(() => setNow(new Date()));
    return () => {
      active = false;
      clearInterval(timer);
      foreground();
    };
  }, []);

  return (
    <ScrollView
      style={s.fill}
      contentContainerStyle={[
        s.page,
        { paddingTop: m.space.lg, paddingBottom: bottom + m.space.lg, gap: m.space.lg },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          tintColor={colors.ink}
          onRefresh={() => {
            setNow(new Date());
            void query.refetch();
          }}
        />
      }
    >
      <Text accessibilityRole="header" style={[s.title, { color: colors.ink }]}>
        {t('tabs.notifications')}
      </Text>
      <View
        accessibilityRole="tablist"
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: m.space.sm }}
      >
        {NOTIFICATION_FILTERS.map((filter) => (
          <Pressable
            key={filter}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === filter }}
            onPress={() => setKind(filter)}
            style={({ pressed }) => ({
              minHeight: 34,
              borderRadius: m.radius.pill,
              paddingHorizontal: m.space.md,
              justifyContent: 'center',
              backgroundColor: kind === filter ? colors.ink : colors.chip,
              opacity: pressed ? m.pressedOpacity : 1,
            })}
          >
            <Text
              style={{
                fontFamily: m.fontExtraBold,
                fontSize: m.type.button,
                color: kind === filter ? colors.bg : colors.ink2,
              }}
            >
              {t(`social.notifications.filter.${filter}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      {query.isError ? (
        <View style={s.center}>
          <Text accessibilityRole="alert" style={[s.support, { color: colors.muted }]}>
            {t('social.notifications.loadFailed')}
          </Text>
          <Button secondary label={t('common.tryAgain')} onPress={() => void query.refetch()} />
        </View>
      ) : !query.data ? (
        <ActivityIndicator accessibilityLabel={t('day.loading')} color={colors.ink} />
      ) : visible.length === 0 ? (
        <View style={s.center}>
          <Text style={[s.support, { color: colors.muted }]}>
            {t(kind === 'all' ? 'social.notifications.empty' : 'social.notifications.filterEmpty')}
          </Text>
        </View>
      ) : (
        NOTIFICATION_SECTIONS.map(
          (section) =>
            groups[section].length > 0 && (
              <View key={section}>
                <Text
                  accessibilityRole="header"
                  style={{
                    color: colors.muted,
                    fontFamily: m.fontExtraBold,
                    fontSize: m.type.supporting,
                  }}
                >
                  {t(`social.notifications.section.${section}`)}
                </Text>
                {groups[section].map((row) => (
                  <NotificationRow
                    key={row.id}
                    client={client}
                    me={me}
                    row={row}
                    section={section}
                    now={now}
                    timeZone={timezone}
                    relation={relations.data?.get(row.actorId)}
                    onPerson={onPerson}
                    onToday={onToday}
                  />
                ))}
              </View>
            ),
        )
      )}
      {dismissed === false &&
        following &&
        prefs.data?.friendDone === false &&
        query.data &&
        !query.isError && (
          <View
            style={[
              s.row,
              {
                borderRadius: m.radius.field,
                backgroundColor: colors.chip,
                paddingHorizontal: m.space.md,
              },
            ]}
          >
            <Text style={[s.support, { color: colors.ink2, flex: 1 }]}>
              {t('social.notifications.prompt')}
            </Text>
            <SmallAction label={t('social.notifications.enable')} onPress={onSettings} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('social.notifications.dismiss')}
              onPress={() => {
                setDismissed(true);
                void AsyncStorage.setItem(promptKey, '1').catch(() => {});
              }}
              style={{ minHeight: m.height.touch, justifyContent: 'center' }}
            >
              <SocialIcon name="close" color={colors.muted} size={20} />
            </Pressable>
          </View>
        )}
    </ScrollView>
  );
}
