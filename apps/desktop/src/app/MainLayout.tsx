import { useEffect, useRef, useState } from 'react';
import type { NodiiClient, Session } from '@nodii/api';
import type { Profile } from '@nodii/core';
import { DayView, DaySkeleton } from '../features/day-list/DayView';
import { GoalManagerSheet } from '../features/goals/GoalManagerSheet';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { logout } from '../lib/logout';
import { MonthCalendar } from '../features/calendar/MonthCalendar';
import { RoutineListSheet } from '../features/routines/RoutineListSheet';

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
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [routinesOpen, setRoutinesOpen] = useState(false);
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const settings = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const logoutButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    logoutButton.current?.focus();
    function close(event: PointerEvent) {
      if (event.target instanceof Node && !settings.current?.contains(event.target))
        setMenuOpen(false);
    }
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  async function handleLogout() {
    if (pending) return;
    setPending(true);
    try {
      const { localOnly } = await logout(client, queryClient);
      if (localOnly) toast.success('이 기기에서 로그아웃했어요');
    } catch {
      toast.error('로그아웃하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setPending(false);
    }
  }

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
          <div aria-label="연결 상태" />
          <div
            className="settings-menu"
            ref={settings}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMenuOpen(false);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setMenuOpen(false);
                settingsButton.current?.focus();
              }
            }}
          >
            <Button
              ref={settingsButton}
              variant="ghost"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-controls="account-menu"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              설정
            </Button>
            {menuOpen && (
              <div id="account-menu" className="account-menu" role="menu" aria-label="계정">
                <p className="supporting email-address">{session.user.email}</p>
                <Button
                  ref={logoutButton}
                  role="menuitem"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => void handleLogout()}
                >
                  {pending ? '로그아웃 중…' : '로그아웃'}
                </Button>
              </div>
            )}
          </div>
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
