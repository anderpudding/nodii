import { useMemo } from 'react';
import { buildDay, monthKeyOf, type Profile } from '@nodii/core';
import {
  useGoals,
  useMonthTodos,
  useRoutines,
  useMonthRoutineLogs,
  type NodiiClient,
} from '@nodii/api';
import { useUIStore } from '../../stores/ui';
import { Button } from '../../components/ui/button';
import { DayHeader } from './DayHeader';
import { DayList } from './DayList';
import { OverdueBanner } from './OverdueBanner';

/** 조회 중에도 목록의 자리를 유지해 빈 창을 보여주지 않는다. */
export function DaySkeleton() {
  return (
    <div role="status" aria-label="하루 목록 불러오는 중" className="day-skeleton">
      <div />
      <div />
      <div />
    </div>
  );
}
/** 날짜가 달을 넘으면 해당 월의 42칸 캐시를 구독한다. */
export function DayView({ client, profile }: { client: NodiiClient; profile: Profile }) {
  const date = useUIStore((state) => state.selectedDate);
  const goals = useGoals(client);
  const todos = useMonthTodos(client, monthKeyOf(date), profile.weekStart);
  const routines = useRoutines(client);
  const logs = useMonthRoutineLogs(client, monthKeyOf(date), profile.weekStart);
  // TODO-09: 헤더와 목록이 같은 전개 결과를 써서 숨겨진 항목을 세지 않는다.
  const groups = useMemo(
    () =>
      buildDay({
        date,
        goals: goals.data ?? [],
        todos: todos.data ?? [],
        routines: routines.data ?? [],
        logs: logs.data ?? [],
        timeZone: profile.timezone,
      }),
    [date, goals.data, todos.data, routines.data, logs.data, profile.timezone],
  );
  const items = groups.flatMap((group) => group.items);
  const done = items.filter((item) =>
    item.kind === 'todo' ? item.todo.isDone : item.log?.status === 'done',
  ).length;
  return (
    <>
      <DayHeader total={items.length} done={done} />
      {(goals.isError && !goals.data) || (todos.isError && !todos.data) ? (
        <div className="day-empty">
          <p role="alert">하루 목록을 불러오지 못했어요.</p>
          <Button
            variant="outline"
            onClick={() => {
              void goals.refetch();
              void todos.refetch();
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : !goals.data || !todos.data ? (
        <DaySkeleton />
      ) : (
        <>
          {(routines.isError || logs.isError) && (
            <div className="day-empty">
              <p role="alert" className="supporting">
                루틴 기록을 불러오지 못했어요.
              </p>
              <Button
                variant="ghost"
                onClick={() => {
                  void routines.refetch();
                  void logs.refetch();
                }}
              >
                다시 시도
              </Button>
            </div>
          )}
          <OverdueBanner
            client={client}
            weekStart={profile.weekStart}
            goals={goals.data}
            todayItems={items}
          />
          <DayList
            key={date}
            client={client}
            profile={profile}
            groups={groups}
            todos={todos.data}
            routines={routines.data ?? []}
            routinesReady={!!routines.data && !!logs.data}
          />
        </>
      )}
    </>
  );
}
