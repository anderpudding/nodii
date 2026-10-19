import {
  addDays,
  buildDay,
  keyBetween,
  lastSortKey,
  monthKeyOf,
  normalizeTitle,
  summarizeMonth,
  weekdayOf,
  type Goal,
  type ISODate,
  type Todo,
  type RoutineLog,
} from '@nodii/core';
import type { RoutineRecord, TodoRecord } from '@nodii/api';

/** CAL-05: 일/월 시작 설정을 UTC 달력 연산으로 적용한다. */
export function weekRange(date: ISODate, weekStart: 0 | 1) {
  const from = addDays(date, -((weekdayOf(date) - weekStart + 7) % 7));
  return {
    from,
    to: addDays(from, 6),
    dates: Array.from({ length: 7 }, (_, i) => addDays(from, i)),
  };
}
/** 두 42칸 캐시의 중복 행은 날짜가 속한 달에서 한 번만 읽는다 (CAL-02/07). */
export function mergeWeekTodos<T extends { date: ISODate }>(
  from: ISODate,
  to: ISODate,
  first: readonly T[],
  last: readonly T[],
) {
  const firstMonth = monthKeyOf(from);
  const lastMonth = monthKeyOf(to);
  return [
    ...first.filter((row) => monthKeyOf(row.date) === firstMonth),
    ...(firstMonth === lastMonth ? [] : last.filter((row) => monthKeyOf(row.date) === lastMonth)),
  ];
}
export type MobileDayItem = (
  | { kind: 'todo'; todo: TodoRecord }
  | { kind: 'routine'; routine: RoutineRecord; log: RoutineLog | null }
) & { id: string; isDone: boolean };
/** TODO-09/ROUT-05: 공용 전개 순서를 보존하고 실제 서버 행을 메뉴에 전달한다. */
export function daySections(
  goals: Goal[],
  todos: TodoRecord[],
  date: ISODate,
  timeZone: string,
  routines: RoutineRecord[] = [],
  logs: RoutineLog[] = [],
) {
  const byId = new Map(todos.map((todo) => [todo.id, todo]));
  const routineById = new Map(routines.map((routine) => [routine.id, routine]));
  return buildDay({ goals, todos, routines, logs, date, timeZone }).map((group) => ({
    key: group.goal.id,
    goal: group.goal,
    canAdd: group.canAdd,
    data: group.items.flatMap<MobileDayItem>((item) => {
      if (item.kind === 'todo') {
        const todo = byId.get(item.todo.id);
        return todo ? [{ kind: 'todo', id: todo.id, isDone: todo.isDone, todo }] : [];
      }
      const routine = routineById.get(item.routine.id);
      return routine
        ? [
            {
              kind: 'routine',
              id: routine.id,
              isDone: item.log?.status === 'done',
              routine,
              log: item.log,
            },
          ]
        : [];
    }),
  }));
}
/** CAL-02/ROUT-05: 주·월·날짜 시트가 같은 루틴·로그를 함께 집계한다. */
export function weekSummary(
  goals: Goal[],
  todos: TodoRecord[],
  from: ISODate,
  to: ISODate,
  timeZone: string,
  routines: RoutineRecord[] = [],
  logs: RoutineLog[] = [],
) {
  return summarizeMonth({ goals, todos, routines, logs, from, to, timeZone });
}
/** TODO-01: 선택 목표의 같은 날짜에만 마지막 키를 찾아 연속 입력 충돌을 막는다. */
export function newTodo(
  id: string,
  goalId: string,
  date: ISODate,
  title: string,
  todos: readonly Todo[],
): Todo | null {
  const normalized = normalizeTitle(title);
  if (!normalized) return null;
  return {
    id,
    goalId,
    date,
    title: normalized,
    isDone: false,
    sortKey: keyBetween(
      lastSortKey(todos.filter((todo) => todo.goalId === goalId && todo.date === date)),
      null,
    ),
  };
}
/** 한국어 IME 확인용 Enter는 제출로 해석하지 않는다. 네이티브는 UIKit의 submit 이벤트만 받는다. */
export function submissionTitle(value: string, event?: unknown) {
  if (event && typeof event === 'object') {
    if ('isComposing' in event && event.isComposing === true) return null;
    if ('keyCode' in event && event.keyCode === 229) return null;
  }
  return normalizeTitle(value);
}
/** 마지막 목표가 보관되었다면 첫 활성 목표로 돌아간다 (GOAL-05). */
export function preferredGoal(goals: Goal[], lastId: string | null) {
  const active = goals.filter((goal) => goal.archivedAt === null);
  return active.find((goal) => goal.id === lastId) ?? active[0];
}
