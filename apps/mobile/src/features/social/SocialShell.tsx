import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  fetchProfile,
  useMySocialProfile,
  usePendingInvite,
  useShareInvite,
  useSocialProfile,
  type NodiiClient,
} from '@nodii/api';
import { inviteUrl, socialTabs, type SocialProfile, type SocialTab } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useReducedMotion, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { SettingsIcon } from '../../components/SettingsIcon';
import { useToast } from '../../components/Toast';
import { Settings } from '../settings/Settings';
import {
  Avatar,
  ProfileNav,
  ProfileTool,
  SocialIcon,
  profileStyles as s,
  tabInset,
  TodayVisible,
} from './Primitives';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSetup, ProfileFieldEditor, type ProfileField } from './ProfileForms';
import { ProfileEdit } from './ProfileEdit';
import { DefaultVisibilityScreen } from './ProfilePrivacy';

type Page =
  | { kind: 'edit' | 'settings' | 'visibility' }
  | { kind: 'field'; field: ProfileField; from: 'edit' | 'settings' };
type SettingsProps = {
  email: string;
  onLogout(): void;
  loggingOut: boolean;
  onAccountDeleted(): Promise<void>;
};

function OtherProfile({
  client,
  userId,
  onBack,
  from,
}: {
  client: NodiiClient;
  userId: string;
  onBack(): void;
  from: SocialTab;
}) {
  const query = useSocialProfile(client, userId);
  const { colors } = useTheme();
  return (
    <>
      <ProfileNav back={`‹ ${t(`tabs.${from}`)}`} onBack={onBack} />
      {query.isPending ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : query.isError || !query.data ? (
        <View style={s.center}>
          <Avatar size={84} label={t('tabs.profile')} />
          <Text style={[s.heading, { color: colors.ink }]}>{t('social.profile.gone')}</Text>
        </View>
      ) : (
        <ProfileHeader client={client} profile={query.data} />
      )}
    </>
  );
}

function MyProfile({
  client,
  profile,
  onEdit,
  onSettings,
  bottom,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  onEdit(): void;
  onSettings(): void;
  bottom: number;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const reduced = useReducedMotion();
  const [scroll] = useState(() => new Animated.Value(0));
  const [compact, setCompact] = useState(false);
  const collapse = scroll.interpolate({
    inputRange: reduced ? [59, 60] : [0, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const expanded = collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const share = useShareInvite(client, profile.userId, async (token) => {
    await Share.share({ message: t('social.invite.message', { url: inviteUrl(token) }) });
  });
  const send = () =>
    share.mutate(undefined, { onError: () => toast(() => t('social.invite.shareFailed')) });
  return (
    <View style={s.fill}>
      <View style={[s.row, { justifyContent: 'flex-end', paddingHorizontal: m.space.lg }]}>
        <ProfileTool label={t('social.find')} onPress={() => {}}>
          <SocialIcon name="find" color={colors.ink} />
        </ProfileTool>
        <ProfileTool label={t('settings.title')} onPress={onSettings}>
          <SettingsIcon color={colors.ink} />
        </ProfileTool>
      </View>
      <Animated.ScrollView
        scrollEventThrottle={16}
        contentContainerStyle={[s.page, { paddingBottom: bottom + m.space.lg, gap: m.space.lg }]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scroll } } }], {
          useNativeDriver: true,
          listener: (event) => {
            const offset = (event.nativeEvent as { contentOffset: { y: number } }).contentOffset.y;
            setCompact(offset >= 60);
          },
        })}
      >
        <View accessibilityElementsHidden={compact}>
          <ProfileHeader client={client} profile={profile} opacity={expanded} />
        </View>
        <View style={[s.row, { marginVertical: m.space.sm, justifyContent: 'center' }]}>
          {(['following', 'followers'] as const).map((key, index) => (
            <View
              key={key}
              style={{
                flex: 1,
                alignItems: 'center',
                borderLeftColor: colors.line,
                borderLeftWidth: index ? m.border : 0,
              }}
            >
              <Text style={[s.heading, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                0
              </Text>
              <Text style={[s.support, { color: colors.muted }]}>{t(`social.${key}`)}</Text>
            </View>
          ))}
        </View>
        <View style={s.row}>
          <View style={s.fill}>
            <Button pill secondary label={t('social.edit')} onPress={onEdit} />
          </View>
          <View style={s.fill}>
            <Button
              pill
              secondary
              label={t('social.share')}
              disabled={share.isPending}
              onPress={send}
            />
          </View>
        </View>
        <View
          style={{
            backgroundColor: colors.chip,
            borderRadius: 20,
            alignItems: 'center',
            gap: m.space.sm,
            padding: m.space.lg,
          }}
        >
          <Text style={[s.heading, { color: colors.ink, textAlign: 'center' }]}>
            {t('social.invite.title')}
          </Text>
          <Text style={[s.support, { color: colors.muted, textAlign: 'center' }]}>
            {t('social.invite.description')}
          </Text>
          <Button pill label={t('social.invite.send')} disabled={share.isPending} onPress={send} />
        </View>
      </Animated.ScrollView>
      <Animated.View
        pointerEvents="none"
        accessibilityElementsHidden={!compact}
        style={{
          position: 'absolute',
          top: 44,
          left: 0,
          right: 0,
          backgroundColor: colors.bg,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
          opacity: collapse,
        }}
      >
        <ProfileHeader client={client} profile={profile} compact />
      </Animated.View>
    </View>
  );
}

/** D20·SOC-08: 오늘 목록은 탭을 바꿔도 다시 마운트하지 않는다. */
export function SocialShell({
  client,
  userId,
  enabled,
  token,
  consume,
  children,
  ...settings
}: SettingsProps & {
  client: NodiiClient;
  userId: string;
  enabled: boolean;
  token: string | null;
  consume(token: string): void;
  children: ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const { top, bottom } = useSafeAreaInsets();
  const toast = useToast();
  const [tab, setTab] = useState<SocialTab>('today');
  const [page, setPage] = useState<Page | null>(null);
  const [other, setOther] = useState<string | null>(null);
  const mine = useMySocialProfile(client, userId, enabled && (tab === 'profile' || !!token));
  const account = useQuery({
    queryKey: ['profile', userId],
    queryFn: ({ signal }) => fetchProfile(client, userId, signal),
    enabled: enabled && !!page,
    staleTime: 30_000,
  });
  const select = useCallback((next: SocialTab) => {
    setTab(next);
    setPage(null);
    setOther(null);
  }, []);
  const receive = useCallback(
    (used: string, target: string | null) => {
      consume(used);
      if (!target) {
        toast(() => t('social.invite.openFailed'));
        return;
      }
      if (target === userId) select('profile');
      else {
        setPage(null);
        setOther(target);
      }
    },
    [consume, select, toast, userId],
  );
  usePendingInvite(client, token, enabled && !!mine.data && !mine.isFetching, receive);
  const active = enabled
    ? token && (mine.data === null || mine.isError)
      ? 'profile'
      : tab
    : 'today';
  const inset = bottom + tabInset;
  const showOther = enabled && !!other;
  const showPage = enabled && active === 'profile' && !!mine.data && page;
  const back = () => {
    if (other) setOther(null);
    else
      setPage(
        page?.kind === 'field'
          ? { kind: page.from }
          : page?.kind === 'visibility'
            ? { kind: 'settings' }
            : null,
      );
  };
  const modal = showOther || (showPage && page?.kind !== 'settings');
  return (
    <View style={s.fill}>
      <View
        style={active === 'today' ? s.fill : { display: 'none' }}
        accessibilityElementsHidden={active !== 'today' || showOther}
        importantForAccessibility={active !== 'today' || showOther ? 'no-hide-descendants' : 'auto'}
      >
        <TodayVisible.Provider value={active === 'today' && !showOther}>
          {children}
        </TodayVisible.Provider>
      </View>
      {enabled && active !== 'today' && !modal && (
        <View style={[s.fill, { paddingTop: top }]}>
          {active === 'notifications' ? (
            <>
              <Text
                accessibilityRole="header"
                style={[s.title, { color: colors.ink, margin: m.space.lg }]}
              >
                {t('tabs.notifications')}
              </Text>
              <View style={s.center}>
                <Text style={[s.support, { color: colors.muted }]}>
                  {t('social.notifications.empty')}
                </Text>
              </View>
            </>
          ) : mine.data ? (
            <MyProfile
              client={client}
              profile={mine.data}
              bottom={inset}
              onEdit={() => setPage({ kind: 'edit' })}
              onSettings={() => setPage({ kind: 'settings' })}
            />
          ) : mine.data === null ? (
            <ProfileSetup client={client} userId={userId} bottom={inset} />
          ) : (
            <View style={s.center}>
              {mine.isError ? (
                <>
                  <Text accessibilityRole="alert" style={[s.support, { color: colors.danger }]}>
                    {t('social.profile.loadFailed')}
                  </Text>
                  <Button
                    secondary
                    label={t('common.tryAgain')}
                    onPress={() => void mine.refetch()}
                  />
                </>
              ) : (
                <ActivityIndicator color={colors.ink} />
              )}
            </View>
          )}
        </View>
      )}
      {enabled && !showOther && !showPage && (
        <View
          accessibilityRole="tablist"
          style={{
            position: 'absolute',
            bottom: bottom + 6,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: m.space.xs,
            height: 60,
            paddingHorizontal: m.space.sm,
            borderRadius: m.radius.pill,
            backgroundColor: colors.surface,
            boxShadow: isDark
              ? '0 8px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.07)'
              : '0 8px 28px rgba(17,19,24,0.14), 0 0 0 1px rgba(17,19,24,0.05)',
          }}
        >
          {socialTabs.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="tab"
              accessibilityLabel={t(`tabs.${name}`)}
              accessibilityState={{ selected: active === name }}
              onPress={() => select(name)}
              style={({ pressed }) => ({
                width: 64,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: active === name ? colors.tabSelected : 'transparent',
                borderRadius: m.radius.pill,
                opacity: pressed ? m.pressedOpacity : 1,
              })}
            >
              <SocialIcon name={name} color={active === name ? colors.ink : colors.muted} />
            </Pressable>
          ))}
        </View>
      )}
      {showPage && page?.kind === 'settings' && mine.data && account.data && (
        <Settings
          {...settings}
          client={client}
          profile={account.data}
          onClose={() => setPage(null)}
          social={{
            profile: mine.data,
            onHandle: () => setPage({ kind: 'field', field: 'handle', from: 'settings' }),
            onVisibility: () => setPage({ kind: 'visibility' }),
          }}
        />
      )}
      {showPage && page?.kind === 'settings' && !account.data && (
        <View style={[s.center, { position: 'absolute', inset: 0, backgroundColor: colors.bg }]}>
          {account.isError ? (
            <Button secondary label={t('common.tryAgain')} onPress={() => void account.refetch()} />
          ) : (
            <ActivityIndicator color={colors.ink} />
          )}
          <Button quiet label={t('mobile.add.cancel')} onPress={back} />
        </View>
      )}
      {!!modal && (
        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            inset: 0,
            paddingTop: top,
            paddingBottom: bottom,
            backgroundColor: colors.bg,
          }}
        >
          {showOther && other ? (
            <OtherProfile client={client} userId={other} from={tab} onBack={back} />
          ) : mine.data && page?.kind === 'edit' ? (
            <ProfileEdit
              client={client}
              profile={mine.data}
              onBack={back}
              onField={(field) => setPage({ kind: 'field', field, from: 'edit' })}
            />
          ) : mine.data && page?.kind === 'field' ? (
            <ProfileFieldEditor
              key={page.field}
              client={client}
              profile={mine.data}
              field={page.field}
              back={`‹ ${t(page.from === 'edit' ? 'social.edit' : 'settings.title')}`}
              onBack={back}
            />
          ) : page?.kind === 'visibility' ? (
            <DefaultVisibilityScreen
              client={client}
              userId={userId}
              visibility={account.data?.defaultVisibility ?? 'private'}
              onBack={back}
            />
          ) : null}
        </View>
      )}
    </View>
  );
}
