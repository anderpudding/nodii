import { monthGridRange } from '@nodii/core';
import { useQuery } from '@tanstack/react-query';
import type { NodiiClient } from '../client';
import { queryKeys } from '../query-keys';
import { listGoals } from '../repositories/goals';
import { listTodosInRange } from '../repositories/todos';

/** 활성·보관 목표를 하나의 서버 캐시로 공유한다. */
export function useGoals(client: NodiiClient) {
  return useQuery({
    queryKey: queryKeys.goals(),
    queryFn: ({ signal }) => listGoals(client, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
/** 사용자 설정의 주 시작 요일로 42칸 범위를 조회한다. */
export function useMonthTodos(client: NodiiClient, monthKey: string, weekStart: 0 | 1) {
  const { from, to } = monthGridRange(monthKey, weekStart);
  return useQuery({
    queryKey: queryKeys.todos(monthKey),
    queryFn: ({ signal }) => listTodosInRange(client, from, to, signal),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}
