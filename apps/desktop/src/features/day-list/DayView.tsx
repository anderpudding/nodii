import { monthKeyOf, type Profile } from '@nodii/core';
import { useGoals, useMonthTodos, type NodiiClient } from '@nodii/api';
import { useUIStore } from '../../stores/ui';
import { Button } from '../../components/ui/button';
import { DayHeader } from './DayHeader';
import { DayList } from './DayList';

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
  const dayTodos = todos.data?.filter((todo) => todo.date === date) ?? [];
  return (
    <>
      <DayHeader total={dayTodos.length} done={dayTodos.filter((todo) => todo.isDone).length} />
      {goals.isError || todos.isError ? (
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
        <DayList
          key={date}
          client={client}
          profile={profile}
          goals={goals.data}
          todos={todos.data}
        />
      )}
    </>
  );
}
