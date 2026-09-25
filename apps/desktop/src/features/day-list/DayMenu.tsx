import { useEffect, useId, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Popover from '@radix-ui/react-popover';
import { useIsMutating, useQueryClient } from '@tanstack/react-query';
import {
  buildDay,
  keyBetween,
  lastSortKey,
  monthKeyOf,
  planOverdueMove,
  type DayItem,
  type Goal,
  type Profile,
} from '@nodii/core';
import {
  assertOnline,
  listRoutines,
  monthRoutineLogsOptions,
  monthTodosOptions,
  queryKeys,
  useBulkDeleteTodos,
  useBulkMoveTodos,
  useOverdueTodos,
  type NodiiClient,
  type TodoRecord,
  type TodoMove,
} from '@nodii/api';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Sheet } from '../../components/ui/sheet';
import { useConnectivity } from '../../lib/connectivity';
import { notifyError } from '../../lib/notify-error';
import { useUIStore } from '../../stores/ui';
import { formatCalendarDate } from '../calendar/CalendarGrid';
import { TodoDatePicker } from './TodoDatePicker';

/** 날짜별 미완료 할 일만 대상으로 가져오기·이동·삭제와 실행 취소를 제공한다 (TODO-10~12). */
export function DayMenu({
  client,
  profile,
  goals,
  items,
  todos,
  ready,
}: {
  client: NodiiClient;
  profile: Profile;
  goals: Goal[];
  items: DayItem[];
  todos: TodoRecord[];
  ready: boolean;
}) {
  const { selectedDate, today } = useUIStore();
  const cache = useQueryClient();
  const online = useConnectivity();
  const writes = useIsMutating({ mutationKey: ['write'] });
  const overdue = useOverdueTodos(client, today, selectedDate === today);
  const move = useBulkMoveTodos(client, profile.weekStart, { onError: notifyError });
  const remove = useBulkDeleteTodos(client, profile.weekStart, { onError: notifyError });
  const [open, setOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [month, setMonth] = useState(monthKeyOf(selectedDate));
  const more = useRef<HTMLButtonElement>(null);
  const id = useId();
  const visibleIds = new Set(items.flatMap((item) => (item.kind === 'todo' ? [item.todo.id] : [])));
  const targets = todos.filter(
    (todo) =>
      visibleIds.has(todo.id) && todo.date === selectedDate && !todo.isDone && !todo.deletedAt,
  );
  const imports = planOverdueMove({ overdue: overdue.data ?? [], todayItems: items, goals, today });
  const reason = !online
    ? '오프라인이라 보기만 할 수 있어요'
    : writes || preparing
      ? '저장이 끝나면 쓸 수 있어요'
      : !ready
        ? '목록을 불러온 뒤 쓸 수 있어요'
        : '';
  const importReason =
    reason ||
    (selectedDate !== today
      ? '오늘 화면에서만 쓸 수 있어요'
      : overdue.isError
        ? '지난 할 일을 불러오지 못했어요'
        : overdue.isPending
          ? '지난 할 일을 불러오고 있어요'
          : !imports.length
            ? '가져올 할 일이 없어요'
            : '');
  const targetReason = reason || (!targets.length ? '미완료 할 일이 없어요' : '');
  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (!(event.target instanceof Element && event.target.closest('[role="menu"]')))
        setOpen(false);
    };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open]);

  function moveWithUndo(originals: TodoRecord[], moves: TodoMove[], date: string, message: string) {
    const request = move.mutateAsync({ todos: originals, moves, date });
    const toastId = toast(message, {
      duration: 5000,
      action: {
        label: '실행 취소',
        onClick: () => {
          void request
            .then(async () => {
              // 가져오기는 원래 날짜별로 원자적으로 복원하며 실패한 묶음은 다시 시도할 수 있다.
              for (const originalDate of new Set(originals.map((todo) => todo.date))) {
                const group = originals.filter((todo) => todo.date === originalDate);
                await move
                  .mutateAsync({
                    todos: group.map((todo) => ({
                      ...todo,
                      date,
                      sortKey: moves.find((m) => m.id === todo.id)!.sort_key,
                    })),
                    moves: group.map((todo) => ({ id: todo.id, sort_key: todo.sortKey })),
                    date: originalDate,
                  })
                  .catch(() => {
                    /* 공통 오류 토스트 */
                  });
              }
            })
            .catch(() => {
              /* 공통 오류 토스트 */
            });
        },
      },
    });
    void request.catch(() => toast.dismiss(toastId));
  }
  async function moveTo(date: string) {
    if (date === selectedDate || targetReason) return;
    const originals = targets;
    setPreparing(true);
    try {
      assertOnline();
      const [target, routines, logs] = await Promise.all([
        cache.fetchQuery(monthTodosOptions(client, monthKeyOf(date), profile.weekStart)),
        cache.fetchQuery({
          queryKey: queryKeys.routines(),
          queryFn: ({ signal }) => listRoutines(client, signal),
          staleTime: 30_000,
        }),
        cache.fetchQuery(monthRoutineLogsOptions(client, monthKeyOf(date), profile.weekStart)),
      ]);
      assertOnline();
      if (cache.isMutating({ mutationKey: ['write'] })) throw new Error('write_in_progress');
      // 대상 날짜 조회 중 완료·삭제·이동된 항목을 오래된 스냅샷으로 옮기지 않는다.
      const latest = cache.getQueryData<TodoRecord[]>(queryKeys.todos(monthKeyOf(selectedDate)));
      if (
        !originals.every((todo) =>
          latest?.some(
            (row) =>
              row.id === todo.id &&
              row.date === todo.date &&
              !row.isDone &&
              !row.deletedAt &&
              row.sortKey === todo.sortKey,
          ),
        )
      ) {
        throw new Error('todos_changed_while_preparing');
      }
      const groups = buildDay({
        date,
        goals,
        todos: target,
        routines,
        logs,
        timeZone: profile.timezone,
      });
      const tails = new Map(groups.map((group) => [group.goal.id, lastSortKey(group.items)]));
      const moves = [...originals]
        .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
        .map((todo) => {
          const sort_key = keyBetween(tails.get(todo.goalId) ?? null, null);
          tails.set(todo.goalId, sort_key);
          return { id: todo.id, sort_key };
        });
      moveWithUndo(
        originals,
        moves,
        date,
        `${originals.length}개를 ${formatCalendarDate(date)}로 옮겼어요`,
      );
    } catch (error) {
      notifyError(error, () => {
        void moveTo(date);
      });
    } finally {
      setPreparing(false);
    }
  }
  function deleteTodos() {
    if (targetReason) return;
    const originals = targets;
    setConfirm(false);
    requestAnimationFrame(() => more.current?.focus());
    const request = remove.mutateAsync({ todos: originals });
    const toastId = toast(`${originals.length}개를 삭제했어요`, {
      duration: 5000,
      action: {
        label: '실행 취소',
        onClick: () => {
          void request
            .then((saved) => remove.mutate({ todos: saved, restore: true }))
            .catch(() => {
              /* 공통 오류 토스트 */
            });
        },
      },
    });
    void request.catch(() => toast.dismiss(toastId));
  }
  return (
    <>
      <Popover.Root open={picker} onOpenChange={setPicker}>
        <DropdownMenu.Root open={open} onOpenChange={setOpen}>
          <Popover.Anchor asChild>
            <DropdownMenu.Trigger asChild>
              <Button ref={more} variant="ghost" aria-label="하루 메뉴">
                ⋯
              </Button>
            </DropdownMenu.Trigger>
          </Popover.Anchor>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="todo-menu day-menu"
              align="end"
              sideOffset={4}
              collisionPadding={8}
              aria-label="하루 메뉴"
              onCloseAutoFocus={(event) => {
                if (picker || confirm) event.preventDefault();
                if (confirm)
                  requestAnimationFrame(() =>
                    document
                      .querySelector<HTMLButtonElement>('[role="alertdialog"] [data-initial-focus]')
                      ?.focus(),
                  );
              }}
            >
              <DropdownMenu.Item
                className="todo-menu-item"
                disabled={!!importReason}
                onSelect={() => {
                  const originals = (overdue.data ?? []).filter((todo) =>
                    imports.some((m) => m.id === todo.id),
                  );
                  moveWithUndo(
                    originals,
                    imports,
                    today,
                    `${imports.length}개를 오늘로 가져왔어요`,
                  );
                }}
              >
                지난 미완료 할 일 {imports.length}개 가져오기
                {importReason && <span>{importReason}</span>}
              </DropdownMenu.Item>
              {overdue.isError && selectedDate === today && (
                <DropdownMenu.Item
                  className="todo-menu-item"
                  onSelect={() => void overdue.refetch()}
                >
                  다시 시도
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item
                className="todo-menu-item"
                disabled={!!targetReason}
                onSelect={() => {
                  setMonth(monthKeyOf(selectedDate));
                  setPicker(true);
                }}
              >
                미완료 할 일 다른 날로 옮기기{targetReason && <span>{targetReason}</span>}
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="todo-menu-separator" />
              <DropdownMenu.Item
                className="todo-menu-item danger-text"
                disabled={!!targetReason}
                onSelect={() => setConfirm(true)}
              >
                미완료 할 일 전체 삭제{targetReason && <span>{targetReason}</span>}
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <TodoDatePicker
          month={month}
          selectedDate={selectedDate}
          today={today}
          weekStart={profile.weekStart}
          onMonthChange={setMonth}
          onSelect={(date) => {
            setPicker(false);
            void moveTo(date);
          }}
          onReturnFocus={() => more.current?.focus()}
        />
      </Popover.Root>
      {confirm && (
        <Sheet
          role="alertdialog"
          className="routine-modal"
          labelledBy={`${id}-title`}
          describedBy={`${id}-description`}
          onClose={() => {
            setConfirm(false);
            requestAnimationFrame(() => more.current?.focus());
          }}
        >
          <h2 id={`${id}-title`}>미완료 할 일 {targets.length}개를 삭제할까요?</h2>
          <p id={`${id}-description`} className="supporting">
            완료한 할 일과 루틴은 남아요.
          </p>
          <div className="routine-actions">
            <Button
              variant="ghost"
              data-initial-focus
              onClick={() => {
                setConfirm(false);
                requestAnimationFrame(() => more.current?.focus());
              }}
            >
              취소
            </Button>
            <Button className="routine-danger" disabled={!!targetReason} onClick={deleteTodos}>
              삭제
            </Button>
          </div>
        </Sheet>
      )}
    </>
  );
}
