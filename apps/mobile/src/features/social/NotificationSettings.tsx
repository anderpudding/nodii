import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import {
  avatarUrl,
  useFriendDoneSettings,
  useNotificationPrefs,
  useUpdateNotificationSettings,
  type NodiiClient,
} from '@nodii/api';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { ManagementScreen } from '../../components/ManagementScreen';
import { useToast } from '../../components/Toast';
import { settingsStyles as s } from '../settings/styles';
import { Avatar, SocialIcon } from './Primitives';
import { ProfileSwitch } from './ProfilePrivacy';

interface Props {
  client: NodiiClient;
  me: string;
}

function SettingSwitch({
  label,
  checked,
  disabled,
  onPress,
  children,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onPress(): void;
  children?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.row,
        s.horizontal,
        { borderBottomColor: colors.line, opacity: pressed ? m.pressedOpacity : 1 },
      ]}
    >
      {children ?? <Text style={[s.body, { color: colors.ink, flex: 1 }]}>{label}</Text>}
      <ProfileSwitch checked={checked} />
    </Pressable>
  );
}

function SettingsFailure({ retry }: { retry(): void }) {
  const { colors } = useTheme();
  return (
    <View style={s.note}>
      <Text accessibilityRole="alert" style={[s.supporting, { color: colors.ink2 }]}>
        {t('social.notificationSettings.loadFailed')}
      </Text>
      <Button secondary label={t('common.tryAgain')} onPress={retry} />
    </View>
  );
}

/** SOC-53: 알림 종류별 설정을 계정과 개인정보 사이에 표시한다. */
export function NotificationSettings({
  client,
  me,
  onFriendDone,
}: Props & { onFriendDone(): void }) {
  const { colors } = useTheme();
  const toast = useToast();
  const prefs = useNotificationPrefs(client, me);
  const friends = useFriendDoneSettings(client, me);
  const write = useUpdateNotificationSettings(client, me, () =>
    toast(() => t('social.save.failed')),
  );
  const summary = !friends.ready
    ? '–'
    : friends.global && !friends.hasOverrides
      ? t('social.notificationSettings.all')
      : friends.count
        ? t('social.notificationSettings.count', { count: friends.count })
        : t('social.notificationSettings.off');
  return (
    <View style={s.group}>
      <Text accessibilityRole="header" style={[s.label, { color: colors.ink2 }]}>
        {t('tabs.notifications')}
      </Text>
      <View style={[s.card, { backgroundColor: colors.chip }]}>
        <View style={s.rows}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('social.notificationSettings.title')}
            accessibilityValue={{ text: summary }}
            onPress={onFriendDone}
            style={({ pressed }) => [
              s.horizontal,
              s.row,
              { borderBottomColor: colors.line, opacity: pressed ? m.pressedOpacity : 1 },
            ]}
          >
            <Text style={[s.body, { color: colors.ink, flex: 1 }]}>
              {t('social.notificationSettings.title')}
            </Text>
            <Text style={[s.supporting, { color: colors.muted }]}>{summary}</Text>
            <SocialIcon name="chevronRight" color={colors.muted} size={20} />
          </Pressable>
          {prefs.isError ? (
            <SettingsFailure retry={() => void prefs.refetch()} />
          ) : (
            (['newFollower', 'reaction'] as const).map((key) => (
              <SettingSwitch
                key={key}
                label={t(`social.notificationSettings.${key}`)}
                checked={prefs.data?.[key] ?? true}
                disabled={!prefs.isSuccess || write.isPending}
                onPress={() => {
                  if (prefs.data) write.update({ prefs: { [key]: !prefs.data[key] } });
                }}
              />
            ))
          )}
        </View>
      </View>
    </View>
  );
}

/** SOC-51: 설정 하위 화면에서 전체 설정과 다른 사람만 예외로 저장한다. */
export function FriendDoneSettings({ client, me, onBack }: Props & { onBack(): void }) {
  const { colors } = useTheme();
  const state = useFriendDoneSettings(client, me);
  const toast = useToast();
  const write = useUpdateNotificationSettings(client, me, () =>
    toast(() => t('social.save.failed')),
  );
  return (
    <ManagementScreen
      inline
      title={t('social.notificationSettings.title')}
      back={`‹ ${t('settings.title')}`}
      onClose={onBack}
      testID="friend-done-settings"
    >
      {state.failed ? (
        <SettingsFailure retry={state.reload} />
      ) : !state.ready ? (
        <ActivityIndicator accessibilityLabel={t('day.loading')} color={colors.ink} />
      ) : (
        <>
          <View style={[s.card, { backgroundColor: colors.chip }]}>
            <View style={s.rows}>
              <SettingSwitch
                label={t('social.notificationSettings.allFriends')}
                checked={!!state.global}
                disabled={write.isPending}
                onPress={() => write.update({ prefs: { friendDone: !state.global } })}
              />
            </View>
          </View>
          <Text style={[s.supporting, { color: colors.muted }]}>
            {t('social.notificationSettings.help')}
          </Text>
          {state.people?.length ? (
            <View style={s.group}>
              <Text accessibilityRole="header" style={[s.label, { color: colors.muted }]}>
                {t('social.notificationSettings.byPerson')}
              </Text>
              <View style={[s.card, { backgroundColor: colors.chip }]}>
                <View style={s.rows}>
                  {state.people.map(({ profile, overridden, checked }) => (
                    <SettingSwitch
                      key={profile.userId}
                      label={profile.nickname}
                      checked={checked}
                      disabled={write.isPending}
                      onPress={() =>
                        write.update({
                          actorId: profile.userId,
                          friendDone: !checked,
                          global: !!state.global,
                        })
                      }
                    >
                      <Avatar
                        size={40}
                        label={profile.nickname}
                        photoUrl={
                          profile.avatarPath
                            ? avatarUrl(client, profile.avatarPath, 160)
                            : undefined
                        }
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[s.body, { color: colors.ink }]}>{profile.nickname}</Text>
                        <Text style={[s.supporting, { color: colors.muted }]}>
                          {t('social.handle.display', { handle: profile.handle })}
                        </Text>
                        {overridden && (
                          <Text
                            style={{
                              color: colors.muted,
                              fontSize: m.type.label,
                              fontFamily: m.fontFamily,
                            }}
                          >
                            {t('social.notificationSettings.override')}
                          </Text>
                        )}
                      </View>
                    </SettingSwitch>
                  ))}
                </View>
              </View>
            </View>
          ) : (
            <Text style={[s.supporting, { color: colors.muted }]}>
              {t('social.notificationSettings.noFollowing')}
            </Text>
          )}
        </>
      )}
    </ManagementScreen>
  );
}
