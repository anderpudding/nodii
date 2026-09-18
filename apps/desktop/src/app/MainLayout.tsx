import { useEffect, useRef, useState } from 'react';
import type { NodiiClient, Session } from '@nodii/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { logout } from '../lib/logout';
import { useUIStore } from '../stores/ui';

/** 2단계 셸: 캘린더·목록 데이터는 이후 단계에서 이 자리에 연결한다. */
export function MainLayout({ client, session }: { client: NodiiClient; session: Session }) {
  const selectedDate = useUIStore((state) => state.selectedDate);
  const today = useUIStore((state) => state.today);
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const settings = useRef<HTMLDivElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const logoutButton = useRef<HTMLButtonElement>(null);
  const date = new Date(`${selectedDate}T00:00:00Z`);
  const format = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('ko-KR', { ...options, timeZone: 'UTC' }).format(date);

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
        <section className="calendar-placeholder" aria-label="캘린더 자리">
          <h2>{format({ year: 'numeric', month: 'long' })}</h2>
          <p className="supporting">캘린더를 준비하고 있어요.</p>
        </section>
        <nav className="management" aria-label="관리">
          <Button variant="ghost" disabled>
            목표 관리
          </Button>
          <Button variant="ghost" disabled>
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
          <h1>{format({ month: 'long', day: 'numeric', weekday: 'long' })}</h1>
          <p className="supporting">{selectedDate === today ? '오늘' : selectedDate}</p>
          <div className="day-placeholder">
            <p className="supporting">하루 목록을 준비하고 있어요.</p>
          </div>
        </main>
      </div>
    </div>
  );
}
