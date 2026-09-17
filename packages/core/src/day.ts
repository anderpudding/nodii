import { fromEpochDay, isoDateInZone, toEpochDay } from './date';
import { occursOn } from './recurrence';
import { compareSortKey } from './sort-key';
import type {
  DayGoalGroup,
  DayItem,
  DaySummary,
  Goal,
  ISODate,
  Routine,
  RoutineLog,
  Todo,
} from './types';

export interface RoutineExpansionInput {
  routines: readonly Routine[];
  logs: readonly RoutineLog[];
  goals: readonly Goal[];
  from: ISODate;
  to: ISODate;
  timeZone: string;
}

export interface DayRangeInput extends RoutineExpansionInput {
  todos: readonly Todo[];
}

export interface BuildDayInput extends Omit<DayRangeInput, 'from' | 'to'> {
  date: ISODate;
}

function appendItem(days: Map<ISODate, DayItem[]>, date: ISODate, item: DayItem): void {
  const items = days.get(date);
  if (items) items.push(item);
  else days.set(date, [item]);
}

/** 행을 생성하지 않고 규칙·로그·목표 보관일로 날짜별 루틴을 만든다 (ROUT-05~09). */
export function expandRoutines({
  routines,
  logs,
  goals,
  from,
  to,
  timeZone,
}: RoutineExpansionInput): Map<ISODate, DayItem[]> {
  const days = new Map<ISODate, DayItem[]>();
  const goalEnds = new Map(
    goals.map((goal) => [
      goal.id,
      goal.archivedAt === null ? null : isoDateInZone(goal.archivedAt, timeZone),
    ]),
  );
  const logIndex = new Map(logs.map((log) => [`${log.routineId}:${log.date}`, log]));
  const start = toEpochDay(from);
  const end = toEpochDay(to);
  for (let day = start; day <= end; day++) {
    const date = fromEpochDay(day);
    for (const routine of routines) {
      const archivedDate = goalEnds.get(routine.goalId);
      // I2: 삭제된 목표는 제외하고 보관 당일까지는 과거 표시를 유지한다.
      if (archivedDate === undefined || (archivedDate !== null && date > archivedDate)) continue;
      if (!occursOn(routine, date)) continue;
      const log = logIndex.get(`${routine.id}:${date}`) ?? null;
      if (log?.status === 'skipped') continue;
      appendItem(days, date, {
        kind: 'routine',
        goalId: routine.goalId,
        sortKey: routine.sortKey,
        routine,
        log,
      });
    }
  }
  return days;
}

function collectDays(input: DayRangeInput): Map<ISODate, DayItem[]> {
  const days = expandRoutines(input);
  const goalIds = new Set(input.goals.map((goal) => goal.id));
  for (const todo of input.todos) {
    if (todo.date < input.from || todo.date > input.to || !goalIds.has(todo.goalId)) continue;
    appendItem(days, todo.date, { kind: 'todo', goalId: todo.goalId, sortKey: todo.sortKey, todo });
  }
  return days;
}

function compareItems(a: DayItem, b: DayItem): number {
  const order = compareSortKey(a.sortKey, b.sortKey);
  if (order !== 0) return order;
  if (a.kind !== b.kind) return a.kind === 'todo' ? -1 : 1;
  return compareSortKey(
    a.kind === 'todo' ? a.todo.id : a.routine.id,
    b.kind === 'todo' ? b.todo.id : b.routine.id,
  );
}

/** 목표별 혼합 목록과 추가 가능 여부를 함께 계산한다 (TODO-09, GOAL-05). */
export function buildDay(input: BuildDayInput): DayGoalGroup[] {
  const items = collectDays({ ...input, from: input.date, to: input.date }).get(input.date) ?? [];
  return [...input.goals]
    .sort((a, b) => compareSortKey(a.sortKey, b.sortKey) || compareSortKey(a.id, b.id))
    .map((goal) => ({
      goal,
      items: items.filter((item) => item.goalId === goal.id).sort(compareItems),
      canAdd: goal.archivedAt === null,
    }))
    .filter((group) => group.canAdd || group.items.length > 0);
}

/** 하루 목록과 같은 전개 결과를 사용해 캘린더 숫자가 어긋나지 않게 한다 (CAL-02). */
export function summarizeMonth(input: DayRangeInput): Map<ISODate, DaySummary> {
  const summary = new Map<ISODate, DaySummary>();
  for (const [date, items] of collectDays(input)) {
    const remaining = items.filter((item) =>
      item.kind === 'todo' ? !item.todo.isDone : item.log?.status !== 'done',
    ).length;
    summary.set(date, { total: items.length, remaining });
  }
  return summary;
}
