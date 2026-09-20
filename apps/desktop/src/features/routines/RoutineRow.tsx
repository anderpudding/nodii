import { useConnectivity } from '../../lib/connectivity';
import { useEffect, useRef, useState } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  useRoutineWritePending,
  useSetRoutineLog,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import type { RoutineLog } from '@nodii/core';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { notifyError } from '../../lib/notify-error';
import { useUIStore } from '../../stores/ui';

/** 가상 항목은 규칙을 복제하지 않고 해당 날짜의 기록만 쓴다 (ROUT-05~07). */
export function RoutineRow({
  routine,
  log,
  date,
  client,
  weekStart,
  disabled = false,
  onEdit,
  onStop,
}: {
  routine: RoutineRecord;
  log: RoutineLog | null;
  date: string;
  client: NodiiClient;
  weekStart: 0 | 1;
  onEdit: () => void;
  onStop: (deleting: boolean) => void;
  disabled?: boolean;
}) {
  const online = useConnectivity();
  const setLog = useSetRoutineLog(client, weekStart, routine.id, date, { onError: notifyError });
  const busy = useRoutineWritePending(routine.id, date) || disabled;
  const done = log?.status === 'done';
  const today = useUIStore((state) => state.today);
  const more = useRef<HTMLButtonElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [contextVersion, setContextVersion] = useState(0);
  const focusGoal = useRef(false);
  useEffect(() => {
    if (!dropdownOpen && !contextOpen) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[role="menu"]')) return;
      setDropdownOpen(false);
      setContextOpen(false);
      setContextVersion((value) => value + 1);
    };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [dropdownOpen, contextOpen]);
  function skip() {
    focusGoal.current = true;
    more.current?.closest('section')?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
    const request = setLog.mutateAsync({ routineId: routine.id, date, status: 'skipped' });
    const id = toast('이날은 건너뛰었어요', {
      duration: 5000,
      action: {
        label: '실행 취소',
        onClick: () => {
          void request
            .then(() => setLog.mutate({ routineId: routine.id, date, status: null }))
            .catch(() => {
              /* 공통 오류 처리 */
            });
        },
      },
    });
    void request.catch(() => toast.dismiss(id));
  }
  function content(kind: 'context' | 'dropdown') {
    const Item = kind === 'context' ? ContextMenu.Item : DropdownMenu.Item;
    return (
      <>
        <Item className="todo-menu-item" disabled={busy} onSelect={skip}>
          이날은 건너뛰기
        </Item>
        <Item className="todo-menu-item" disabled={busy} onSelect={onEdit}>
          루틴 수정
        </Item>
        <Item
          className="todo-menu-item"
          disabled={busy || (routine.endDate !== null && routine.endDate < today)}
          onSelect={() => onStop(false)}
        >
          오늘부터 그만하기
        </Item>
        <Item className="todo-menu-item danger-text" disabled={busy} onSelect={() => onStop(true)}>
          삭제
        </Item>
      </>
    );
  }
  function restoreFocus(event: Event) {
    event.preventDefault();
    if (focusGoal.current)
      more.current?.closest('section')?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
    else more.current?.focus();
  }
  return (
    <ContextMenu.Root
      key={contextVersion}
      onOpenChange={(open) => {
        focusGoal.current = false;
        setContextOpen(open);
      }}
    >
      <ContextMenu.Trigger asChild disabled={busy}>
        <div className={`todo-row${done ? ' todo-done' : ''}`}>
          <button
            type="button"
            className="todo-check"
            aria-disabled={!online || undefined}
            aria-label={`${routine.title} 완료`}
            aria-pressed={done}
            disabled={busy}
            onClick={() =>
              setLog.mutate({ routineId: routine.id, date, status: done ? null : 'done' })
            }
          >
            {done && (
              <svg viewBox="0 0 22 22" aria-hidden="true">
                <path d="m5 11 4 4 8-8" />
              </svg>
            )}
          </button>
          <span className="todo-title">{routine.title}</span>
          <svg className="routine-icon" viewBox="0 0 24 24" role="img" aria-label="반복 루틴">
            <path d="M19 8a8 8 0 1 0 1 8M19 3v5h-5" />
          </svg>
          <DropdownMenu.Root
            open={dropdownOpen}
            onOpenChange={(open) => {
              focusGoal.current = false;
              setDropdownOpen(open);
            }}
          >
            <DropdownMenu.Trigger asChild>
              <Button
                ref={more}
                variant="ghost"
                className="todo-more"
                aria-label={`${routine.title} 메뉴`}
                disabled={busy}
              >
                ⋯
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="todo-menu"
                align="end"
                sideOffset={4}
                collisionPadding={8}
                aria-label="루틴 메뉴"
                onCloseAutoFocus={restoreFocus}
              >
                {content('dropdown')}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </ContextMenu.Trigger>
      {contextOpen && (
        <ContextMenu.Portal>
          <ContextMenu.Content
            className="todo-menu"
            collisionPadding={8}
            aria-label="루틴 메뉴"
            onCloseAutoFocus={restoreFocus}
          >
            {content('context')}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
}
