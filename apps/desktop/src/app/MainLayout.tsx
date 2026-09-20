import { useEffect, useState } from 'react';
import type { NodiiClient, Session } from '@nodii/api';
import type { Profile } from '@nodii/core';
import { DayView, DaySkeleton } from '../features/day-list/DayView';
import { GoalManagerSheet } from '../features/goals/GoalManagerSheet';
import { Button } from '../components/ui/button';
import { SettingsSheet } from '../features/settings/SettingsSheet';
import { MonthCalendar } from '../features/calendar/MonthCalendar';
import { RoutineListSheet } from '../features/routines/RoutineListSheet';
import { useUserSync } from '../lib/use-user-sync';
import { useTodayClock } from '../lib/today';
import { useConnectionStatus } from '../lib/connectivity';

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
      ? '오프라인이라 보기만 할 수 있어요'
      : connectionStatus === 'sync-disconnected'
        ? '동기화가 잠시 끊겼어요'
        : null;
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.metaKey && event.key === ',' && !event.isComposing) {
        event.preventDefault();
        setSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="캘린더와 관리 메뉴">
        <p className="brand">Nodii</p>
        {profile && <MonthCalendar client={client} profile={profile} />}
        <nav className="management" aria-label="관리">
          <Button variant="ghost" onClick={() => setGoalsOpen(true)}>
            목표 관리
          </Button>
          <Button variant="ghost" disabled={!profile} onClick={() => setRoutinesOpen(true)}>
            루틴 관리
          </Button>
        </nav>
      </aside>
      <div className="day-panel">
        <header className="app-toolbar">
          <div aria-label="연결 상태" role="status">
            {connectionMessage && (
              <span className="offline-status" title={connectionMessage}>
                {connectionMessage}
              </span>
            )}
          </div>
          <Button variant="ghost" aria-haspopup="dialog" onClick={() => setSettingsOpen(true)}>
            설정
          </Button>
        </header>
        <main className="day-content">
          {profile ? (
            <DayView client={client} profile={profile} />
          ) : profileError ? (
            <div>
              <p role="alert">날짜 설정을 불러오지 못했어요.</p>
              <Button variant="outline" onClick={retryProfile}>
                다시 시도
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
        />
      )}
      {goalsOpen && <GoalManagerSheet client={client} onClose={() => setGoalsOpen(false)} />}
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
