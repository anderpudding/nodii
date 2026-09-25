import { useIsMutating } from '@tanstack/react-query';
import { SortableList } from '../../components/ui/sortable-list';
import { reorderedKey } from '../../lib/reorder';
import { useConnectivity } from '../../lib/connectivity';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import { keyBetween, lastSortKey, type DayGoalGroup, type Profile } from '@nodii/core';
import {
  useCreateTodo,
  useReorderTodo,
  type NodiiClient,
  type TodoRecord,
  type RoutineRecord,
} from '@nodii/api';
import { useUIStore } from '../../stores/ui';
import { notifyError } from '../../lib/notify-error';
import { GoalChip, goalStyle } from '../goals/GoalChip';
import { AddTodoInput } from './AddTodoInput';
import { TodoRow } from './TodoRow';
import { RoutineRow } from '../routines/RoutineRow';
import { RoutineEditor } from '../routines/RoutineEditor';
import { RoutineStopDialog } from '../routines/RoutineStopDialog';
import type { AppCommand } from '../../lib/commands';

/** 캐시를 복사하지 않고 core 계산 결과로 목표별 하루를 그린다 (TODO-09). */
export function DayList({
  client,
  profile,
  groups,
  todos,
  routines,
  routinesReady,
}: {
  client: NodiiClient;
  profile: Profile;
  groups: DayGoalGroup[];
  todos: TodoRecord[];
  routines: RoutineRecord[];
  routinesReady: boolean;
}) {
  const date = useUIStore((state) => state.selectedDate);
  const [adding, setAdding] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ routine?: RoutineRecord; goalId?: string } | null>(null);
  const [stopping, setStopping] = useState<{ routine: RoutineRecord; deleting: boolean } | null>(
    null,
  );
  const root = useRef<HTMLDivElement>(null);
  const create = useCreateTodo(client, profile.weekStart, { onError: notifyError });
  useEffect(() => {
    const command = (event: Event) => {
      if (
        (event as CustomEvent<AppCommand>).detail !== 'new-todo' ||
        document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')
      )
        return;
      const last = useUIStore.getState().lastAddedGoalByDate[date];
      const target =
        groups.find(({ goal, canAdd }) => canAdd && goal.id === last) ??
        groups.find(({ canAdd }) => canAdd);
      if (target) {
        setAdding(target.goal.id);
        // 이미 열린 입력 줄도 다시 포커스한다.
        root.current?.querySelector<HTMLInputElement>('.add-todo input')?.focus();
      }
    };
    window.addEventListener('nodii:command', command);
    return () => window.removeEventListener('nodii:command', command);
  }, [date, groups]);
  const reorder = useReorderTodo(client, profile.weekStart, { onError: notifyError });
  const writing = useIsMutating({ mutationKey: ['write'] }) > 0;
  const online = useConnectivity();
  const hasItems = groups.some((group) => group.items.length > 0);
  return (
    <div ref={root}>
      {!hasItems && (
        <p className="supporting day-empty">
          이날은 비어 있어요. 목표 이름을 누르면 할 일을 바로 추가할 수 있어요.
        </p>
      )}
      <div className="goal-groups">
        {groups.map(({ goal, items, canAdd }) => (
          <section
            className="goal-group"
            key={goal.id}
            style={goalStyle(goal.color)}
            aria-label={goal.name}
          >
            <div className="routine-group-heading">
              <GoalChip goal={goal} onAdd={canAdd ? () => setAdding(goal.id) : undefined} />
            </div>
            <div className="todo-rows">
              <SortableList
                items={items.map((item) => ({
                  id: item.kind === 'todo' ? item.todo.id : item.routine.id,
                  label: item.kind === 'todo' ? item.todo.title : item.routine.title,
                  draggable: item.kind === 'todo',
                }))}
                disabled={writing || !online || !routinesReady}
                onMove={(id, overId) => {
                  const todo = todos.find(
                    (row) => row.id === id && row.goalId === goal.id && row.date === date,
                  );
                  if (!todo) return;
                  try {
                    const sortKey = reorderedKey(
                      items.map((item) => (item.kind === 'todo' ? item.todo : item.routine)),
                      id,
                      overId,
                    );
                    if (sortKey) reorder.mutate({ todo, sortKey });
                  } catch {
                    toast.error('순서를 바꾸지 못했어요. 목록을 새로 열고 다시 시도해 주세요.');
                  }
                }}
              >
                {({ id }) => {
                  const item = items.find(
                    (item) => (item.kind === 'todo' ? item.todo.id : item.routine.id) === id,
                  )!;
                  return item.kind === 'todo' ? (
                    <TodoRow
                      key={item.todo.id}
                      todo={todos.find((todo) => todo.id === item.todo.id)!}
                      client={client}
                      weekStart={profile.weekStart}
                      timeZone={profile.timezone}
                    />
                  ) : (
                    <RoutineRow
                      key={`${item.routine.id}:${date}`}
                      routine={routines.find((r) => r.id === item.routine.id)!}
                      log={item.log}
                      date={date}
                      client={client}
                      weekStart={profile.weekStart}
                      disabled={!routinesReady}
                      onEdit={() =>
                        setEditor({ routine: routines.find((r) => r.id === item.routine.id)! })
                      }
                      onStop={(deleting) =>
                        setStopping({
                          routine: routines.find((r) => r.id === item.routine.id)!,
                          deleting,
                        })
                      }
                    />
                  );
                }}
              </SortableList>
              {canAdd && adding === goal.id && (
                <AddTodoInput
                  goalName={goal.name}
                  onClose={(reason) => {
                    setAdding(null);
                    // 바깥 클릭으로 닫을 때는 포커스를 클릭한 곳에 둔다.
                    if (reason === 'outside') return;
                    const section = Array.from(
                      root.current?.querySelectorAll('section') ?? [],
                    ).find((element) => element.getAttribute('aria-label') === goal.name);
                    section?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
                  }}
                  onAdd={(title) => {
                    create.mutate(
                      {
                        id: crypto.randomUUID(),
                        goalId: goal.id,
                        title,
                        date,
                        isDone: false,
                        sortKey: keyBetween(lastSortKey(items), null),
                      },
                      { onSuccess: () => useUIStore.getState().rememberAddedGoal(date, goal.id) },
                    );
                  }}
                />
              )}
            </div>
          </section>
        ))}
      </div>
      {editor && (
        <RoutineEditor
          client={client}
          profile={profile}
          {...editor}
          onClose={() => setEditor(null)}
        />
      )}
      {stopping && (
        <RoutineStopDialog client={client} {...stopping} onClose={() => setStopping(null)} />
      )}
    </div>
  );
}
