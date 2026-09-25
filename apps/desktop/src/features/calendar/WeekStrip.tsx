import { useMemo, useState } from 'react';
import { addDays, monthKeyOf, summarizeMonth, weekdayOf, type Profile } from '@nodii/core';
import {
  useMonthRoutineLogs,
  useMonthTodos,
  useGoals,
  useRoutines,
  type NodiiClient,
} from '@nodii/api';
import { useUIStore } from '../../stores/ui';
import { Button } from '../../components/ui/button';
import { CalendarGrid } from './CalendarGrid';

/** 월 경계의 두 캐시를 함께 구독하며 셀·키보드는 월간 보기와 공유한다 (CAL-07). */
export function WeekStrip({ client, profile }: { client: NodiiClient; profile: Profile }) {
  const { selectedDate, today, selectDate } = useUIStore();
  const [view, setView] = useState({ selection: selectedDate, date: selectedDate });
  if (view.selection !== selectedDate) setView({ selection: selectedDate, date: selectedDate });
  const date = view.selection === selectedDate ? view.date : selectedDate;
  const from = addDays(date, -((weekdayOf(date) - profile.weekStart + 7) % 7));
  const to = addDays(from, 6);
  const firstMonth = monthKeyOf(from);
  const lastMonth = monthKeyOf(to);
  const goals = useGoals(client);
  const routines = useRoutines(client);
  const firstTodos = useMonthTodos(client, firstMonth, profile.weekStart);
  const lastTodos = useMonthTodos(client, lastMonth, profile.weekStart);
  const firstLogs = useMonthRoutineLogs(client, firstMonth, profile.weekStart);
  const lastLogs = useMonthRoutineLogs(client, lastMonth, profile.weekStart);
  // 날짜가 속한 달의 캐시를 기준으로 중복된 42칸 데이터를 한 번만 집계한다.
  const summary = useMemo(
    () =>
      summarizeMonth({
        from,
        to,
        goals: goals.data ?? [],
        routines: routines.data ?? [],
        timeZone: profile.timezone,
        todos: [
          ...(firstTodos.data ?? []).filter((row) => monthKeyOf(row.date) === firstMonth),
          ...(firstMonth === lastMonth
            ? []
            : (lastTodos.data ?? []).filter((row) => monthKeyOf(row.date) === lastMonth)),
        ],
        logs: [
          ...(firstLogs.data ?? []).filter((row) => monthKeyOf(row.date) === firstMonth),
          ...(firstMonth === lastMonth
            ? []
            : (lastLogs.data ?? []).filter((row) => monthKeyOf(row.date) === lastMonth)),
        ],
      }),
    [
      from,
      to,
      goals.data,
      routines.data,
      profile.timezone,
      firstMonth,
      lastMonth,
      firstTodos.data,
      lastTodos.data,
      firstLogs.data,
      lastLogs.data,
    ],
  );
  const queries = [goals, routines, firstTodos, lastTodos, firstLogs, lastLogs];
  return (
    <section className="week-strip" aria-label="주간 캘린더">
      <CalendarGrid
        month={monthKeyOf(date)}
        selectedDate={selectedDate}
        today={today}
        weekStart={profile.weekStart}
        summary={summary}
        onSelect={selectDate}
        onMonthChange={() => {}}
        week={{ start: from, onChange: (next) => setView({ selection: selectedDate, date: next }) }}
      />
      {queries.some((query) => query.isError) ? (
        <div>
          <p role="alert" className="supporting">
            캘린더를 불러오지 못했어요.
          </p>
          <Button
            variant="ghost"
            onClick={() => {
              for (const query of queries) void query.refetch();
            }}
          >
            다시 시도
          </Button>
        </div>
      ) : queries.some((query) => query.isPending) ? (
        <p role="status" className="supporting">
          캘린더를 불러오고 있어요.
        </p>
      ) : null}
    </section>
  );
}
