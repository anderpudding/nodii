import { t } from '@nodii/i18n';
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
import { SproutCheck } from '../../components/ui/sprout-check';
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
  const skipped = log?.status === 'skipped';
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
    const id = toast(t('routine.skipped.summary'), {
      duration: 5000,
      action: {
        label: t('todo.undo'),
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
          {t('routine.skip.day')}
        </Item>
        <Item className="todo-menu-item" disabled={busy} onSelect={onEdit}>
          {t('routine.edit.action')}
        </Item>
        <Item
          className="todo-menu-item"
          disabled={busy || (routine.endDate !== null && routine.endDate < today)}
          onSelect={() => onStop(false)}
        >
          {t('routine.endToday')}
        </Item>
        <Item className="todo-menu-item danger-text" disabled={busy} onSelect={() => onStop(true)}>
          {t('todo.action.delete')}
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
        <div className={`todo-row${done ? ' todo-done' : skipped ? ' todo-skipped' : ''}`}>
          <button
            type="button"
            className="todo-check check"
            aria-disabled={!online || undefined}
            aria-label={t('todo.completion.label', { title: routine.title })}
            aria-pressed={done}
            disabled={busy}
            onClick={() =>
              setLog.mutate({ routineId: routine.id, date, status: done ? null : 'done' })
            }
          >
            <SproutCheck done={done} skipped={skipped} />
          </button>
          <span className="todo-title">{routine.title}</span>
          {skipped && <span className="routine-skipped-label">{t('routine.skipped.label')}</span>}
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
                aria-label={t('common.menuNamed', { name: routine.title })}
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
                aria-label={t('routine.menu')}
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
            aria-label={t('routine.menu')}
            onCloseAutoFocus={restoreFocus}
          >
            {content('context')}
          </ContextMenu.Content>
        </ContextMenu.Portal>
      )}
    </ContextMenu.Root>
  );
}
