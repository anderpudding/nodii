import { addDays, monthGridRange, monthKeyOf } from '@nodii/core';
import { useQuery, type QueryClient } from '@tanstack/react-query';
import type { NodiiClient } from '../client';
import { queryKeys } from '../query-keys';
import { listGoals } from '../repositories/goals';
import { listOverdue, listTodosInRange } from '../repositories/todos';
import { monthRoutineLogsOptions } from './routines';

/** 활성·보관 목표를 하나의 서버 캐시로 공유한다. */
export function useGoals(client: NodiiClient) {
  return useQuery({
    queryKey: queryKeys.goals(),
    queryFn: ({ signal }) => listGoals(client, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
/** 화면과 미리 불러오기가 동일한 범위·신선도를 사용한다. */
export function monthTodosOptions(client: NodiiClient, monthKey: string, weekStart: 0 | 1) {
  const { from, to } = monthGridRange(monthKey, weekStart);
  return {
    queryKey: queryKeys.todos(monthKey),
    queryFn: ({ signal }: { signal: AbortSignal }) => listTodosInRange(client, from, to, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  };
}
/** 사용자 설정의 주 시작 요일로 42칸 범위를 조회한다. */
export function useMonthTodos(client: NodiiClient, monthKey: string, weekStart: 0 | 1) {
  return useQuery(monthTodosOptions(client, monthKey, weekStart));
}
/** 오늘 화면에서만 최근 미완료 목록을 요청한다 (TODO-10). */
export function useOverdueTodos(client: NodiiClient, today: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.overdue(today),
    queryFn: ({ signal }) => listOverdue(client, today, signal),
    enabled,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
/** DST와 무관하게 월의 첫날을 기준으로 인접 월 키를 찾는다. */
export function adjacentMonthKey(monthKey: string, direction: -1 | 1) {
  return monthKeyOf(addDays(`${monthKey}-01`, direction === -1 ? -1 : 32));
}
/** 월 이동을 기다리지 않고 양쪽 달을 캐시에 준비한다 (NFR-03). */
export async function prefetchAdjacentMonths(
  cache: QueryClient,
  client: NodiiClient,
  monthKey: string,
  weekStart: 0 | 1,
) {
  await Promise.all(
    ([-1, 1] as const).flatMap((direction) => [
      cache.prefetchQuery(
        monthTodosOptions(client, adjacentMonthKey(monthKey, direction), weekStart),
      ),
      cache.prefetchQuery(
        monthRoutineLogsOptions(client, adjacentMonthKey(monthKey, direction), weekStart),
      ),
    ]),
  );
}
