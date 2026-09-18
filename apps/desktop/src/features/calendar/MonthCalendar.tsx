import { useEffect, useMemo, useRef, useState } from 'react';
import { monthGridRange, monthKeyOf, summarizeMonth, type Profile } from '@nodii/core';
import { prefetchAdjacentMonths, useGoals, useMonthTodos, type NodiiClient } from '@nodii/api';
import { useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../../stores/ui';
import { Button } from '../../components/ui/button';
import { CalendarGrid } from './CalendarGrid';

/** 하루 목록과 동일한 월 캐시에서 도장을 계산하고 인접 월을 준비한다. */
export function MonthCalendar({ client, profile }: { client: NodiiClient; profile: Profile }) {
  const { selectedDate, today, selectDate } = useUIStore();
  const [view, setView] = useState({ selection: selectedDate, month: monthKeyOf(selectedDate) });
  // 하루 목록에서 날짜를 바꾸면 월도 따라가며 단순 월 탐색은 선택 날짜를 보존한다.
  if (view.selection !== selectedDate)
    setView({ selection: selectedDate, month: monthKeyOf(selectedDate) });
  const month = view.selection === selectedDate ? view.month : monthKeyOf(selectedDate);
  const cache = useQueryClient();
  const previousWeekStart = useRef(profile.weekStart);
  useEffect(() => {
    if (previousWeekStart.current === profile.weekStart) return;
    previousWeekStart.current = profile.weekStart;
    void cache.invalidateQueries({ queryKey: ['todos'] });
    void cache.invalidateQueries({ queryKey: ['routineLogs'] });
  }, [cache, profile.weekStart]);
  const goals = useGoals(client);
  const todos = useMonthTodos(client, month, profile.weekStart);
  useEffect(() => {
    void prefetchAdjacentMonths(cache, client, month, profile.weekStart);
  }, [cache, client, month, profile.weekStart]);
  const summary = useMemo(
    () =>
      summarizeMonth({
        ...monthGridRange(month, profile.weekStart),
        goals: goals.data ?? [],
        todos: todos.data ?? [],
        routines: [],
        logs: [],
        timeZone: profile.timezone,
      }),
    [month, profile.weekStart, profile.timezone, goals.data, todos.data],
  );
  return (
    <section className="sidebar-calendar" aria-label="월간 캘린더">
      <CalendarGrid
        month={month}
        selectedDate={selectedDate}
        today={today}
        weekStart={profile.weekStart}
        summary={summary}
        onMonthChange={(next) => setView({ selection: selectedDate, month: next })}
        onSelect={selectDate}
      />
      {todos.isError || goals.isError ? (
        <div>
          <p role="alert" className="supporting">
            캘린더를 불러오지 못했어요.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              void todos.refetch();
              void goals.refetch();
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : todos.isPending ? (
        <p role="status" className="supporting">
          캘린더를 불러오고 있어요.
        </p>
      ) : null}
    </section>
  );
}
