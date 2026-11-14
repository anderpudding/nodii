import { TodayPeople } from './TodayPeople';
import { orderTodayPeople } from '@nodii/core';
import { useTodayPeople } from '@nodii/api';
import { AvatarRow } from './AvatarRow';
import { TodaySocialContext } from './TodaySocialContext';
import { VisibilityContext } from './VisibilityContext';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  useMySocialProfile,
  usePendingInvite,
  useMyInvite,
  useFollowCounts,
  useRefreshRelationships,
  type FollowList,
  type NodiiClient,
  type Session,
} from '@nodii/api';
import {
  inviteUrl,
  socialTabs,
  type Profile,
  type SocialProfile,
  type SocialTab,
} from '@nodii/core';
import { t, type MessageKey } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { SettingsIcon } from '../../components/ui/icons';
import { SettingsSheet } from '../settings/SettingsSheet';
import { GoalManagerSheet } from '../goals/GoalManagerSheet';
import { ProfileHeader } from './ProfileHeader';
import { ProfileFieldEditor, ProfileSetup, type ProfileField } from './ProfileForms';
import { ProfileEdit } from './ProfileEdit';
import { DefaultVisibilityScreen } from './ProfilePrivacy';
import { SocialIcon } from './Icons';
import { onSocialForeground } from './InviteReceiver';
import { OtherProfile } from './OtherProfile';
import { BlockedProfiles, FollowListPanel, ProfileSearch } from './PeoplePanels';
import './social.css';

type Panel =
  | { kind: 'edit' | 'settings' | 'visibility' | 'blocked' | 'search' }
  | { kind: 'list'; list: FollowList }
  | { kind: 'field'; field: ProfileField; from: 'edit' | 'settings' };

function Back({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <Button variant="ghost" className="social-back" onClick={onClick}>
      <span aria-hidden="true">‹</span> {label}
    </Button>
  );
}

function MyProfile({
  client,
  profile,
  panel,
  setPanel,
  counts,
  invitePending,
  copy,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  panel: Panel | null;
  setPanel(panel: Panel | null): void;
  counts?: Record<FollowList, number>;
  invitePending: boolean;
  copy(): void;
}) {
  return (
    <section className="social-own" data-open={!!panel}>
      <div className="social-tools">
        <Button
          variant="ghost"
          className="social-tool"
          aria-label={t('social.find')}
          onClick={() => setPanel({ kind: 'search' })}
        >
          <SocialIcon name="find" size={20} />
        </Button>
        <Button
          variant="ghost"
          className="social-tool"
          aria-label={t('settings.title')}
          onClick={() => setPanel({ kind: 'settings' })}
        >
          <SettingsIcon className="toolbar-icon" />
        </Button>
      </div>
      <div className="social-own-body">
        <ProfileHeader client={client} profile={profile} />
        <div className="social-counts">
          {(['following', 'followers'] as const).map((key) => (
            <button
              key={key}
              aria-label={t('social.lists.count', {
                label: t(`social.${key}`),
                count: counts?.[key] ?? '–',
              })}
              type="button"
              aria-pressed={panel?.kind === 'list' && panel.list === key}
              onClick={() => setPanel({ kind: 'list', list: key })}
            >
              <strong>{counts?.[key] ?? '–'}</strong>
              <span>{t(`social.${key}`)}</span>
            </button>
          ))}
        </div>
        <div className="social-profile-actions">
          <Button
            variant={
              panel?.kind === 'edit' || (panel?.kind === 'field' && panel.from === 'edit')
                ? 'default'
                : 'outline'
            }
            onClick={() => setPanel({ kind: 'edit' })}
          >
            {t('social.edit')}
          </Button>
          <Button variant="outline" onClick={copy} disabled={invitePending}>
            {t('social.share')}
          </Button>
        </div>
        {!panel && counts?.following === 0 && (
          <aside className="social-invite">
            <h3>{t('social.invite.title')}</h3>
            <p>{t('social.invite.description')}</p>
            <Button onClick={copy} disabled={invitePending}>
              {t('social.invite.copy')}
            </Button>
          </aside>
        )}
      </div>
    </section>
  );
}

/** D20·SOC-08: 오늘 화면은 탭을 바꿔도 같은 인스턴스로 유지한다. */
export function SocialShell({
  client,
  session,
  profile,
  enabled,
  token,
  consume,
  children,
}: {
  client: NodiiClient;
  session: Session;
  profile?: Profile;
  enabled: boolean;
  token: string | null;
  consume(token: string): void;
  children: ReactNode;
}) {
  const userId = session.user.id;
  useEffect(() => {
    if (!enabled) return;
    document.documentElement.classList.add('social-enabled');
    return () => document.documentElement.classList.remove('social-enabled');
  }, [enabled]);
  const [picked, setPicked] = useState<string | null>(null);
  const [manageToday, setManageToday] = useState(false);
  const todayPeople = useTodayPeople(client, userId, enabled);
  const { shown } = orderTodayPeople(todayPeople.data ?? []);
  const friendId = enabled && shown.some((person) => person.followeeId === picked) ? picked : null;
  if (picked && todayPeople.isSuccess && friendId !== picked) setPicked(null);
  const [tab, setTab] = useState<SocialTab>('today');
  const [panel, setPanel] = useState<Panel | null>(null);
  const [other, setOther] = useState<{ userId: string; from?: MessageKey } | null>(null);
  const [search, setSearch] = useState('');
  const [archive, setArchive] = useState(false);
  const mine = useMySocialProfile(client, userId, enabled);
  const counts = useFollowCounts(client, userId, enabled && tab === 'profile' && !!mine.data);
  useRefreshRelationships(userId, enabled, onSocialForeground);
  const openPanel = (next: Panel | null) => {
    if (next?.kind === 'search') setSearch('');
    setPanel(next);
  };
  const select = useCallback((next: SocialTab) => {
    setTab(next);
    setManageToday(false);
    setOther(null);
    setPanel(null);
  }, []);
  const receive = useCallback(
    (used: string, target: string | null) => {
      consume(used);
      if (!target) {
        toast.error(t('social.invite.openFailed'));
        return;
      }
      if (target === userId) select('profile');
      else {
        setPanel(null);
        setOther({ userId: target });
      }
    },
    [consume, select, userId],
  );
  usePendingInvite(client, token, enabled && !!mine.data && !mine.isFetching, receive);
  useEffect(() => {
    if (!enabled) return;
    const command = (event: Event) => {
      if (
        (event as CustomEvent<string>).detail === 'settings' &&
        !document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
      ) {
        select('profile');
        setPanel({ kind: 'settings' });
      }
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
      )
        return;
      if (event.key === 'Escape') {
        if (other) setOther(null);
        else if (manageToday) setManageToday(false);
        else if (panel)
          setPanel(
            panel.kind === 'field'
              ? { kind: panel.from }
              : panel.kind === 'visibility' || panel.kind === 'blocked'
                ? { kind: 'settings' }
                : null,
          );
        return;
      }
      if (!event.metaKey || event.shiftKey || event.altKey || event.ctrlKey) return;
      const next = socialTabs[Number(event.key) - 1];
      if (next) {
        event.preventDefault();
        select(next);
      }
    };
    window.addEventListener('keydown', key);
    window.addEventListener('nodii:command', command);
    return () => {
      window.removeEventListener('keydown', key);
      window.removeEventListener('nodii:command', command);
    };
  }, [enabled, manageToday, other, panel, select]);

  const active = enabled
    ? token && (mine.data === null || mine.isError)
      ? 'profile'
      : tab
    : 'today';
  const invite = useMyInvite(client, userId, enabled && !!mine.data && tab === 'profile');
  function copy() {
    if (!invite.data) {
      void invite.refetch();
      toast.error(t('social.invite.shareFailed'));
      return;
    }
    const url = inviteUrl(invite.data);
    // WKWebView는 클릭의 동기 구간이 지난 뒤에는 클립보드 권한을 거부할 수 있다.
    const field = document.createElement('textarea');
    field.value = url;
    field.style.position = 'fixed';
    field.style.opacity = '0';
    const focus = document.activeElement;
    document.body.append(field);
    field.select();
    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      /* 브라우저에서 지원하는 클립보드 경로로 이어진다. */
    } finally {
      field.remove();
      if (focus instanceof HTMLElement) focus.focus();
    }
    if (copied) toast.success(t('social.invite.copied'));
    else if (navigator.clipboard)
      void navigator.clipboard.writeText(url).then(
        () => toast.success(t('social.invite.copied')),
        () => toast.error(t('social.invite.shareFailed')),
      );
    else toast.error(t('social.invite.shareFailed'));
  }
  const showingOther = enabled && other;
  const settings = (
    <SettingsSheet
      client={client}
      session={session}
      profile={profile}
      onClose={() => setPanel(null)}
      onOpenArchivedGoals={() => setArchive(true)}
      inline
      social={
        mine.data
          ? {
              profile: mine.data,
              onHandle: () => setPanel({ kind: 'field', field: 'handle', from: 'settings' }),
              onVisibility: () => setPanel({ kind: 'visibility' }),
              onBlocked: () => setPanel({ kind: 'blocked' }),
            }
          : undefined
      }
    />
  );
  const showPanel =
    active === 'profile' && panel && !showingOther && (mine.data || panel.kind === 'settings');
  const peoplePage =
    enabled && active === 'today' && manageToday ? (
      <TodayPeople
        client={client}
        me={userId}
        own={mine.data ?? undefined}
        onBack={() => setManageToday(false)}
        onFind={() => {
          select('profile');
          openPanel({ kind: 'search' });
        }}
      />
    ) : undefined;
  return (
    <VisibilityContext.Provider value={enabled}>
      <div className="social-shell" data-social-enabled={enabled}>
        <div className="social-today" hidden={active !== 'today' || !!showingOther}>
          <TodaySocialContext.Provider
            value={{
              friendId,
              management: peoplePage,
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
        </div>
        {enabled && (
          <>
            {showingOther ? (
              <OtherProfile
                client={client}
                key={showingOther.userId}
                me={userId}
                userId={showingOther.userId}
                from={t(showingOther.from ?? `tabs.${tab}`)}
                onBack={() => setOther(null)}
                onBlocked={() => setOther(null)}
              />
            ) : active === 'notifications' ? (
              <section className="social-notifications">
                <h1>{t('tabs.notifications')}</h1>
                <p className="social-center">{t('social.notifications.empty')}</p>
              </section>
            ) : active === 'profile' ? (
              <section className="social-profile" data-panel={!!showPanel}>
                {mine.data ? (
                  <MyProfile
                    client={client}
                    profile={mine.data}
                    panel={panel}
                    setPanel={openPanel}
                    counts={counts.data}
                    invitePending={invite.isPending}
                    copy={copy}
                  />
                ) : (
                  !showPanel &&
                  (mine.isError ? (
                    <div className="social-center">
                      <p role="alert">{t('social.profile.loadFailed')}</p>
                      <Button onClick={() => void mine.refetch()}>{t('common.tryAgain')}</Button>
                    </div>
                  ) : mine.data === null ? (
                    <ProfileSetup client={client} userId={userId} />
                  ) : (
                    <p className="social-center" role="status">
                      {t('mobile.preparing')}
                    </p>
                  ))
                )}
                {showPanel && (
                  <div className="social-panel">
                    {panel.kind === 'field' && mine.data ? (
                      <ProfileFieldEditor
                        key={panel.field}
                        client={client}
                        profile={mine.data}
                        field={panel.field}
                        onClose={() => setPanel({ kind: panel.from })}
                        back={
                          <Back
                            label={t(panel.from === 'settings' ? 'settings.title' : 'social.edit')}
                            onClick={() => setPanel({ kind: panel.from })}
                          />
                        }
                      />
                    ) : (
                      <>
                        <Back
                          label={t(
                            panel.kind === 'visibility' || panel.kind === 'blocked'
                              ? 'settings.title'
                              : 'tabs.profile',
                          )}
                          onClick={() =>
                            setPanel(
                              panel.kind === 'visibility' || panel.kind === 'blocked'
                                ? { kind: 'settings' }
                                : null,
                            )
                          }
                        />
                        {panel.kind === 'edit' && mine.data ? (
                          <ProfileEdit
                            client={client}
                            profile={mine.data}
                            onField={(field) => setPanel({ kind: 'field', field, from: 'edit' })}
                          />
                        ) : panel.kind === 'visibility' ? (
                          <DefaultVisibilityScreen
                            client={client}
                            userId={userId}
                            visibility={profile?.defaultVisibility ?? 'private'}
                          />
                        ) : panel.kind === 'search' ? (
                          <ProfileSearch
                            client={client}
                            me={userId}
                            text={search}
                            setText={setSearch}
                            onPerson={(target) => setOther({ userId: target, from: 'social.find' })}
                          />
                        ) : panel.kind === 'list' ? (
                          <FollowListPanel
                            client={client}
                            me={userId}
                            kind={panel.list}
                            counts={counts.data}
                            select={(list) => setPanel({ kind: 'list', list })}
                            onFind={() => openPanel({ kind: 'search' })}
                            onInvite={copy}
                            onPerson={(target) =>
                              setOther({ userId: target, from: `social.${panel.list}` })
                            }
                          />
                        ) : panel.kind === 'blocked' ? (
                          <BlockedProfiles client={client} me={userId} />
                        ) : panel.kind === 'settings' ? (
                          settings
                        ) : null}
                      </>
                    )}
                  </div>
                )}
              </section>
            ) : null}
            <nav className="social-tabbar" role="tablist" aria-label={t('tabs.profile')}>
              {socialTabs.map((name, index) => (
                <button
                  type="button"
                  role="tab"
                  key={name}
                  aria-selected={active === name}
                  aria-label={t(`tabs.${name}`)}
                  title={`${t(`tabs.${name}`)} (⌘${index + 1})`}
                  onClick={() => select(name)}
                >
                  <SocialIcon name={name} />
                </button>
              ))}
            </nav>
            {archive && (
              <GoalManagerSheet
                client={client}
                userId={userId}
                initialView="archive"
                onClose={() => setArchive(false)}
              />
            )}
          </>
        )}
      </div>
    </VisibilityContext.Provider>
  );
}
