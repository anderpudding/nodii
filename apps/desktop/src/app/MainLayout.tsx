import { t } from '@nodii/i18n';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { WeekStrip } from '../features/calendar/WeekStrip';
import { useEffect, useState } from 'react';
import type { NodiiClient, Session } from '@nodii/api';
import type { Profile } from '@nodii/core';
import { DayView, DaySkeleton } from '../features/day-list/DayView';
import { GoalManagerSheet } from '../features/goals/GoalManagerSheet';
import { Button } from '../components/ui/button';
import { startBrowserShortcuts, type AppCommand } from '../lib/commands';
import { useUIStore } from '../stores/ui';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { MonthCalendar } from '../features/calendar/MonthCalendar';
import { RoutineListSheet } from '../features/routines/RoutineListSheet';
import { useUserSync } from '../lib/use-user-sync';
import { useTodayClock } from '../lib/today';
import { useConnectionStatus } from '../lib/connectivity';
import { GoalIcon, RoutineIcon, SettingsIcon } from '../components/ui/icons';

/** 인증된 셸 안에서 하루 목록과 목표 관리 시트를 연결한다. */
export function MainLayout({
  client,
  session,
  profile,
  profileError,
  retryProfile,
}: {
  client: NodiiClient;
  session: Session;
  profile?: Profile;
  profileError?: boolean;
  retryProfile?: () => void;
}) {
  useUserSync(client, session.user.id, profile?.weekStart ?? 0);
  useTodayClock();
  const connectionStatus = useConnectionStatus();
  const connectionMessage =
    connectionStatus === 'offline'
      ? t('sync.offline')
      : connectionStatus === 'sync-disconnected'
        ? t('sync.disconnected')
        : null;
  const [goalView, setGoalView] = useState<'list' | 'archive' | null>(null);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const stop = startBrowserShortcuts();
    const command = (event: Event) => {
      // 열린 편집/확인 창을 다른 명령으로 덮지 않는다.
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const value = (event as CustomEvent<AppCommand>).detail;
      if (value === 'settings') setSettingsOpen(true);
      if (value === 'today') useUIStore.getState().selectDate(useUIStore.getState().today);
    };
    window.addEventListener('nodii:command', command);
    return () => {
      stop();
      window.removeEventListener('nodii:command', command);
      useUIStore.setState({ lastAddedGoalByDate: {} });
    };
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label={t('app.sidebar')}>
        {profile && <MonthCalendar client={client} profile={profile} />}
        <nav className="management" aria-label={t('app.management')}>
          <Button variant="ghost" onClick={() => setGoalView('list')}>
            <GoalIcon className="management-icon" />
            {t('goal.manage')}
          </Button>
          <Button variant="ghost" disabled={!profile} onClick={() => setRoutinesOpen(true)}>
            <RoutineIcon className="management-icon" />
            {t('routine.manage')}
          </Button>
        </nav>
      </aside>
      <div className="day-panel">
        <header className="app-toolbar">
          <div aria-label={t('app.connection')} role="status">
            {connectionMessage && (
              <span className="offline-status" title={connectionMessage}>
                {connectionMessage}
              </span>
            )}
          </div>
          <Button
            className="wide-settings"
            variant="ghost"
            aria-label={t('settings.title')}
            aria-haspopup="dialog"
            onClick={() => setSettingsOpen(true)}
          >
            <SettingsIcon className="toolbar-icon" />
          </Button>
          <div className="narrow-settings">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button variant="ghost" aria-label={t('app.settingsManagement')}>
                  <SettingsIcon className="toolbar-icon" />
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="todo-menu"
                  align="end"
                  sideOffset={4}
                  collisionPadding={8}
                >
                  <DropdownMenu.Item
                    className="todo-menu-item"
                    onSelect={() => setGoalView('list')}
                  >
                    {t('goal.manage')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="todo-menu-item"
                    disabled={!profile}
                    onSelect={() => setRoutinesOpen(true)}
                  >
                    {t('routine.manage')}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="todo-menu-separator" />
                  <DropdownMenu.Item
                    className="todo-menu-item"
                    onSelect={() => setSettingsOpen(true)}
                  >
                    {t('settings.title')}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>
        {profile && <WeekStrip client={client} profile={profile} />}
        <main className="day-content">
          {profile ? (
            <DayView client={client} profile={profile} />
          ) : profileError ? (
            <div>
              <p role="alert">{t('app.profile.failed')}</p>
              <Button variant="outline" onClick={retryProfile}>
                {t('common.tryAgain')}
              </Button>
            </div>
          ) : (
            <DaySkeleton />
          )}
        </main>
      </div>
      {settingsOpen && (
        <SettingsSheet
          client={client}
          session={session}
          profile={profile}
          onClose={() => setSettingsOpen(false)}
          onOpenArchivedGoals={() => {
            setSettingsOpen(false);
            setGoalView('archive');
          }}
        />
      )}
      {goalView && (
        <GoalManagerSheet
          client={client}
          initialView={goalView}
          onClose={() => setGoalView(null)}
        />
      )}
      {routinesOpen && profile && (
        <RoutineListSheet
          client={client}
          profile={profile}
          onClose={() => setRoutinesOpen(false)}
        />
      )}
    </div>
  );
}
