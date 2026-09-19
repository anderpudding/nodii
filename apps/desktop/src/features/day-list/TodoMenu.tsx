import { useEffect, useRef, useState, type ReactNode } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { addDays, buildDay, keyBetween, lastSortKey, monthKeyOf } from '@nodii/core';
import {
  monthTodosOptions,
  monthRoutineLogsOptions,
  listRoutines,
  queryKeys,
  useMoveTodo,
  type GoalRecord,
  type NodiiClient,
  type TodoRecord,
} from '@nodii/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { notifyError } from '../../lib/notify-error';
import { useUIStore } from '../../stores/ui';
import { CalendarGrid, formatCalendarDate } from '../calendar/CalendarGrid';

/** 두 진입점이 같은 메뉴를 제공하고 달력 팝오버로 포커스를 넘긴다 (TODO-05). */
export function TodoMenu({
  todo,
  client,
  weekStart,
  timeZone,
  pending,
  editing,
  onEdit,
  onDelete,
  children,
}: {
  todo: TodoRecord;
  client: NodiiClient;
  weekStart: 0 | 1;
  timeZone: string;
  pending: boolean;
  editing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  children: ReactNode;
}) {
  const today = useUIStore((state) => state.today);
  const cache = useQueryClient();
  const move = useMoveTodo(client, weekStart, todo.id, { onError: notifyError });
  const [preparing, setPreparing] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [month, setMonth] = useState(monthKeyOf(todo.date));
  const more = useRef<HTMLButtonElement>(null);
  const focusTarget = useRef<'more' | 'goal' | 'edit' | 'picker'>('more');
  const [contextVersion, setContextVersion] = useState(0);
  useEffect(() => {
    if (!contextOpen && !dropdownOpen) return;
    const close = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('[role="menu"]')) return;
      setDropdownOpen(false);
      setContextOpen(false);
      setContextVersion((value) => value + 1);
    };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [contextOpen, dropdownOpen]);
  const busy = pending || preparing;
  async function moveTo(date: string) {
    if (date === todo.date || busy) return;
    focusTarget.current = 'goal';
    more.current?.closest('section')?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
    setPreparing(true);
    try {
      const [target, routines, logs] = await Promise.all([
        cache.fetchQuery(monthTodosOptions(client, monthKeyOf(date), weekStart)),
        cache.fetchQuery({
          queryKey: queryKeys.routines(),
          queryFn: ({ signal }) => listRoutines(client, signal),
          staleTime: 30_000,
        }),
        cache.fetchQuery(monthRoutineLogsOptions(client, monthKeyOf(date), weekStart)),
      ]);
      const groups = buildDay({
        goals: cache.getQueryData<GoalRecord[]>(queryKeys.goals()) ?? [],
        todos: target.filter((row) => row.id !== todo.id),
        routines,
        logs,
        date,
        timeZone,
      });
      const sortKey = keyBetween(
        lastSortKey(groups.find((group) => group.goal.id === todo.goalId)?.items ?? []),
        null,
      );
      const request = move.mutateAsync({ todo, date, sortKey });
      const toastId = toast(`${formatCalendarDate(date)}로 옮겼어요`, {
        duration: 5000,
        action: {
          label: '실행 취소',
          onClick: () => {
            void request
              .then((saved) => move.mutate({ todo: saved, date: todo.date, sortKey: todo.sortKey }))
              .catch(() => {
                /* 공통 오류 처리 */
              });
          },
        },
      });
      void request.catch(() => toast.dismiss(toastId));
    } catch (error) {
      notifyError(error, () => {
        void moveTo(date);
      });
    } finally {
      setPreparing(false);
    }
  }
  function openPicker() {
    focusTarget.current = 'picker';
    setMonth(monthKeyOf(todo.date));
    setPickerOpen(true);
  }
  const actions = [
    {
      label: '수정',
      run: () => {
        focusTarget.current = 'edit';
        onEdit();
      },
    },
    {
      label: '내일로',
      detail: formatCalendarDate(addDays(todo.date, 1)),
      run: () => {
        void moveTo(addDays(todo.date, 1));
      },
    },
    ...(todo.date === today
      ? []
      : [
          {
            label: '오늘로',
            detail: formatCalendarDate(today),
            run: () => {
              void moveTo(today);
            },
          },
        ]),
    { label: '날짜 선택', run: openPicker },
  ];
  function content(kind: 'context' | 'dropdown') {
    const Item = kind === 'context' ? ContextMenu.Item : DropdownMenu.Item;
    const Separator = kind === 'context' ? ContextMenu.Separator : DropdownMenu.Separator;
    return (
      <>
        {actions.map((action) => (
          <Item className="todo-menu-item" key={action.label} onSelect={action.run} disabled={busy}>
            {action.label}
            {action.detail && <span>{action.detail}</span>}
          </Item>
        ))}
        <Separator className="todo-menu-separator" />
        <Item
          className="todo-menu-item danger-text"
          disabled={busy}
          onSelect={() => {
            focusTarget.current = 'goal';
            onDelete();
          }}
        >
          삭제
        </Item>
      </>
    );
  }
  const onCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    if (focusTarget.current === 'more') more.current?.focus();
    if (focusTarget.current === 'goal')
      more.current?.closest('section')?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
  };
  return (
    <Popover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
      <ContextMenu.Root
        key={contextVersion}
        onOpenChange={(open) => {
          if (open) focusTarget.current = 'more';
          setContextOpen(open);
        }}
      >
        <ContextMenu.Trigger asChild disabled={busy || editing}>
          <div className={`todo-row${todo.isDone ? ' todo-done' : ''}`}>
            {children}
            <DropdownMenu.Root
              open={dropdownOpen}
              onOpenChange={(open) => {
                if (open) focusTarget.current = 'more';
                setDropdownOpen(open);
              }}
            >
              <Popover.Anchor asChild>
                <DropdownMenu.Trigger asChild>
                  <Button
                    ref={more}
                    variant="ghost"
                    className="todo-more"
                    aria-label={`${todo.title} 메뉴`}
                    disabled={busy}
                  >
                    ⋯
                  </Button>
                </DropdownMenu.Trigger>
              </Popover.Anchor>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="todo-menu"
                  align="end"
                  sideOffset={4}
                  collisionPadding={8}
                  aria-label="할 일 메뉴"
                  onCloseAutoFocus={onCloseAutoFocus}
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
              aria-label="할 일 메뉴"
              onCloseAutoFocus={onCloseAutoFocus}
            >
              {content('context')}
            </ContextMenu.Content>
          </ContextMenu.Portal>
        )}
      </ContextMenu.Root>
      {/* 4단계 지시서의 팝오버를 따른다. components.md의 왼쪽 달력 선택 모드와 다름. */}
      <Popover.Portal>
        <Popover.Content
          className="date-popover"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          aria-label="옮길 날짜 선택"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            requestAnimationFrame(() =>
              document.querySelector<HTMLButtonElement>('.date-popover [tabindex="0"]')?.focus(),
            );
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            more.current?.focus();
          }}
        >
          <div className="date-popover-heading">
            <p className="supporting">옮길 날짜를 고르세요</p>
            <Popover.Close asChild>
              <Button variant="ghost">취소</Button>
            </Popover.Close>
          </div>
          <CalendarGrid
            month={month}
            selectedDate={todo.date}
            today={today}
            weekStart={weekStart}
            onMonthChange={setMonth}
            onSelect={(date) => {
              setPickerOpen(false);
              void moveTo(date);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
