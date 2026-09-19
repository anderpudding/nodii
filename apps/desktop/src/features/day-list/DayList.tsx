import { useRef, useState } from 'react';
import { keyBetween, lastSortKey, type DayGoalGroup, type Profile } from '@nodii/core';
import { useCreateTodo, type NodiiClient, type TodoRecord, type RoutineRecord } from '@nodii/api';
import { useUIStore } from '../../stores/ui';
import { notifyError } from '../../lib/notify-error';
import { GoalChip, goalStyle } from '../goals/GoalChip';
import { AddTodoInput } from './AddTodoInput';
import { TodoRow } from './TodoRow';
import { RoutineRow } from '../routines/RoutineRow';
import { RoutineEditor } from '../routines/RoutineEditor';
import { RoutineStopDialog } from '../routines/RoutineStopDialog';
import { Button } from '../../components/ui/button';

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
              {canAdd && (
                <Button
                  variant="ghost"
                  disabled={!routinesReady}
                  onClick={() => setEditor({ goalId: goal.id })}
                  aria-label={`${goal.name}에 루틴 추가`}
                >
                  루틴 추가
                </Button>
              )}
            </div>
            <div className="todo-rows">
              {items.map((item) =>
                item.kind === 'todo' ? (
                  <TodoRow
                    key={item.todo.id}
                    todo={todos.find((todo) => todo.id === item.todo.id)!}
                    client={client}
                    weekStart={profile.weekStart}
                    timeZone={profile.timezone}
                  />
                ) : (
                  <RoutineRow
                    key={item.routine.id}
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
                ),
              )}
              {canAdd && adding === goal.id && (
                <AddTodoInput
                  goalName={goal.name}
                  onClose={() => {
                    setAdding(null);
                    const section = Array.from(
                      root.current?.querySelectorAll('section') ?? [],
                    ).find((element) => element.getAttribute('aria-label') === goal.name);
                    section?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
                  }}
                  onAdd={(title) =>
                    create.mutate({
                      id: crypto.randomUUID(),
                      goalId: goal.id,
                      title,
                      date,
                      isDone: false,
                      sortKey: keyBetween(lastSortKey(items), null),
                    })
                  }
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
