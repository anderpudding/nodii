import { TodayPeople } from './TodayPeople';
import { orderTodayPeople } from '@nodii/core';
import { useTodayPeople } from '@nodii/api';
import { AvatarRow } from './AvatarRow';
import { TodaySocialContext } from './TodaySocialContext';
import { VisibilityContext } from './VisibilityContext';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, Share, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import {
  fetchProfile,
  useMySocialProfile,
  usePendingInvite,
  useShareInvite,
  useFollowCounts,
  useRefreshRelationships,
  type FollowList,
  type NodiiClient,
} from '@nodii/api';
import { inviteUrl, socialTabs, type SocialProfile, type SocialTab } from '@nodii/core';
import { t, type MessageKey } from '@nodii/i18n';
import { metrics as m, useReducedMotion, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { SettingsIcon } from '../../components/SettingsIcon';
import { useToast } from '../../components/Toast';
import { Settings } from '../settings/Settings';
import { ProfileTool, SocialIcon, profileStyles as s, tabInset, TodayVisible } from './Primitives';
import { ProfileHeader } from './ProfileHeader';
import { ProfileSetup, ProfileFieldEditor, type ProfileField } from './ProfileForms';
import { ProfileEdit } from './ProfileEdit';
import { DefaultVisibilityScreen } from './ProfilePrivacy';
import { onSocialForeground } from './invite-receiver';
import { Notifications } from './Notifications';
import { useUIStore } from '../../stores/ui';
import { OtherProfile } from './OtherProfile';
import { BlockedProfiles, FollowListPage, ProfileSearch } from './PeoplePages';

type Page =
  | { kind: 'edit' | 'settings' | 'visibility' | 'search' | 'blocked' }
  | { kind: 'list'; list: FollowList }
  | { kind: 'field'; field: ProfileField; from: 'edit' | 'settings' };
type SettingsProps = {
  email: string;
  onLogout(): void;
  loggingOut: boolean;
  onAccountDeleted(): Promise<void>;
};

function MyProfile({
  client,
  profile,
  onEdit,
  onSettings,
  onFind,
  onList,
  counts,
  send,
  sharing,
  bottom,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  onEdit(): void;
  onSettings(): void;
  onFind(): void;
  onList(kind: FollowList): void;
  counts?: Record<FollowList, number>;
  send(): void;
  sharing: boolean;
  bottom: number;
}) {
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const [scroll] = useState(() => new Animated.Value(0));
  const [compact, setCompact] = useState(false);
  const collapse = scroll.interpolate({
    inputRange: reduced ? [59, 60] : [0, 120],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const expanded = collapse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  return (
    <View style={s.fill}>
      <View style={[s.row, { justifyContent: 'flex-end', paddingHorizontal: m.space.lg }]}>
        <ProfileTool label={t('social.find')} onPress={onFind}>
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
            <Pressable
              key={key}
              accessibilityLabel={t('social.lists.count', {
                label: t(`social.${key}`),
                count: counts?.[key] ?? '–',
              })}
              accessibilityRole="button"
              onPress={() => onList(key)}
              style={{
                flex: 1,
                alignItems: 'center',
                borderLeftColor: colors.line,
                borderLeftWidth: index ? m.border : 0,
              }}
            >
              <Text style={[s.heading, { color: colors.ink, fontVariant: ['tabular-nums'] }]}>
                {counts?.[key] ?? '–'}
              </Text>
              <Text style={[s.support, { color: colors.muted }]}>{t(`social.${key}`)}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.row}>
          <View style={s.fill}>
            <Button pill secondary label={t('social.edit')} onPress={onEdit} />
          </View>
          <View style={s.fill}>
            <Button pill secondary label={t('social.share')} disabled={sharing} onPress={send} />
          </View>
        </View>
        {counts?.following === 0 && (
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
            <Button pill label={t('social.invite.send')} disabled={sharing} onPress={send} />
          </View>
        )}
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
  const [picked, setPicked] = useState<string | null>(null);
  const [manageToday, setManageToday] = useState(false);
  const todayPeople = useTodayPeople(client, userId, enabled);
  const { shown } = orderTodayPeople(todayPeople.data ?? []);
  const friendId = enabled && shown.some((person) => person.followeeId === picked) ? picked : null;
  if (picked && todayPeople.isSuccess && friendId !== picked) setPicked(null);
  const [tab, setTab] = useState<SocialTab>('today');
  const [page, setPage] = useState<Page | null>(null);
  const [other, setOther] = useState<{ userId: string; from?: MessageKey } | null>(null);
  const [search, setSearch] = useState('');
  const mine = useMySocialProfile(client, userId, enabled);
  const counts = useFollowCounts(client, userId, enabled && tab === 'profile' && !!mine.data);
  useRefreshRelationships(userId, enabled, onSocialForeground);
  const share = useShareInvite(client, userId, async (token) => {
    await Share.share({ message: t('social.invite.message', { url: inviteUrl(token) }) });
  });
  const send = () =>
    share.mutate(undefined, { onError: () => toast(() => t('social.invite.shareFailed')) });
  const openSearch = () => {
    setSearch('');
    setPage({ kind: 'search' });
  };
  const account = useQuery({
    queryKey: ['profile', userId],
    queryFn: ({ signal }) => fetchProfile(client, userId, signal),
    enabled: enabled && (!!page || !!other || tab === 'notifications'),
    staleTime: 30_000,
  });
  const select = useCallback((next: SocialTab) => {
    setTab(next);
    setManageToday(false);
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
        setOther({ userId: target });
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
          : page?.kind === 'visibility' || page?.kind === 'blocked'
            ? { kind: 'settings' }
            : null,
      );
  };
  const modal =
    showOther ||
    ((showPage || (enabled && active === 'profile' && page?.kind === 'search')) &&
      page?.kind !== 'settings');
  const peoplePage =
    enabled && active === 'today' && manageToday ? (
      <TodayPeople
        client={client}
        me={userId}
        own={mine.data ?? undefined}
        onBack={() => setManageToday(false)}
        onFind={() => {
          select('profile');
          openSearch();
        }}
      />
    ) : undefined;
  return (
    <VisibilityContext.Provider value={enabled}>
      <View style={s.fill}>
        <View
          style={active === 'today' ? s.fill : { display: 'none' }}
          accessibilityElementsHidden={active !== 'today' || showOther || !!peoplePage}
          importantForAccessibility={
            active !== 'today' || showOther || peoplePage ? 'no-hide-descendants' : 'auto'
          }
        >
          <TodayVisible.Provider value={active === 'today' && !showOther && !peoplePage}>
            <TodaySocialContext.Provider
              value={{
                friendId,
                avatars: enabled ? (
                  <AvatarRow
                    client={client}
                    me={mine.data ?? undefined}
                    people={shown}
                    selected={friendId}
                    onSelect={(id) => {
                      setPicked(id);
                      setManageToday(false);
                    }}
                    onManage={() => setManageToday(!manageToday)}
                  />
                ) : undefined,
              }}
            >
              {children}
            </TodaySocialContext.Provider>
          </TodayVisible.Provider>
        </View>
        {enabled && active !== 'today' && !modal && (
          <View style={[s.fill, { paddingTop: top }]}>
            {active === 'notifications' ? (
              <Notifications
                client={client}
                me={userId}
                timezone={
                  account.data?.timezone ??
                  Intl.DateTimeFormat().resolvedOptions().timeZone ??
                  'UTC'
                }
                weekStart={account.data?.weekStart ?? 0}
                following={!!todayPeople.data?.length}
                bottom={inset}
                onPerson={(id) => setOther({ userId: id, from: 'tabs.notifications' })}
                onToday={(date) => {
                  setPicked(null);
                  useUIStore.getState().selectDate(date);
                  select('today');
                }}
                onSettings={() => {
                  select('profile');
                  setPage({ kind: 'settings' });
                }}
              />
            ) : mine.data ? (
              <MyProfile
                client={client}
                profile={mine.data}
                bottom={inset}
                onEdit={() => setPage({ kind: 'edit' })}
                onSettings={() => setPage({ kind: 'settings' })}
                onFind={openSearch}
                onList={(list) => setPage({ kind: 'list', list })}
                counts={counts.data}
                send={send}
                sharing={share.isPending}
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
        {enabled && !showOther && !showPage && !peoplePage && (
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
              onBlocked: () => setPage({ kind: 'blocked' }),
            }}
          />
        )}
        {showPage && page?.kind === 'settings' && !account.data && (
          <View style={[s.center, { position: 'absolute', inset: 0, backgroundColor: colors.bg }]}>
            {account.isError ? (
              <Button
                secondary
                label={t('common.tryAgain')}
                onPress={() => void account.refetch()}
              />
            ) : (
              <ActivityIndicator color={colors.ink} />
            )}
            <Button quiet label={t('mobile.add.cancel')} onPress={back} />
          </View>
        )}
        {peoplePage && !showOther && (
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
            {peoplePage}
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
              <OtherProfile
                key={other.userId}
                client={client}
                me={userId}
                userId={other.userId}
                from={t(other.from ?? `tabs.${tab}`)}
                onBack={back}
                onBlocked={back}
                calendarProfile={account.data}
              />
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
            ) : page?.kind === 'search' ? (
              <ProfileSearch
                client={client}
                me={userId}
                text={search}
                setText={setSearch}
                onBack={back}
                onPerson={(target) => setOther({ userId: target, from: 'social.find' })}
              />
            ) : page?.kind === 'list' ? (
              <FollowListPage
                client={client}
                me={userId}
                kind={page.list}
                counts={counts.data}
                select={(list) => setPage({ kind: 'list', list })}
                onFind={openSearch}
                onInvite={send}
                onBack={back}
                onPerson={(target) => setOther({ userId: target, from: `social.${page.list}` })}
              />
            ) : page?.kind === 'blocked' ? (
              <BlockedProfiles client={client} me={userId} onBack={back} />
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
    </VisibilityContext.Provider>
  );
}
