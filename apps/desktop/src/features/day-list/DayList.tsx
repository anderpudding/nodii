import { useMemo, useRef, useState } from 'react';
import { buildDay, keyBetween, lastSortKey, type Profile } from '@nodii/core';
import { useCreateTodo, type GoalRecord, type NodiiClient, type TodoRecord } from '@nodii/api';
import { useUIStore } from '../../stores/ui';
import { notifyError } from '../../lib/notify-error';
import { GoalChip, goalStyle } from '../goals/GoalChip';
import { AddTodoInput } from './AddTodoInput';
import { TodoRow } from './TodoRow';

/** 캐시를 복사하지 않고 core 계산 결과로 목표별 하루를 그린다 (TODO-09). */
export function DayList({
  client,
  profile,
  goals,
  todos,
}: {
  client: NodiiClient;
  profile: Profile;
  goals: GoalRecord[];
  todos: TodoRecord[];
}) {
  const date = useUIStore((state) => state.selectedDate);
  const [adding, setAdding] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const create = useCreateTodo(client, profile.weekStart, { onError: notifyError });
  const groups = useMemo(
    () => buildDay({ date, goals, todos, routines: [], logs: [], timeZone: profile.timezone }),
    [date, goals, todos, profile.timezone],
  );
  const dayTodos = todos.filter((todo) => todo.date === date);
  return (
    <div ref={root}>
      {!dayTodos.length && (
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
            <GoalChip goal={goal} onAdd={canAdd ? () => setAdding(goal.id) : undefined} />
            <div className="todo-rows">
              {items.map((item) =>
                item.kind === 'todo' ? (
                  <TodoRow
                    key={item.todo.id}
                    todo={todos.find((todo) => todo.id === item.todo.id)!}
                    client={client}
                    weekStart={profile.weekStart}
                  />
                ) : (
                  <p key={item.routine.id} className="supporting">
                    {item.routine.title}
                  </p>
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
    </div>
  );
}
