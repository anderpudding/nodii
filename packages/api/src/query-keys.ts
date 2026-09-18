/** 설계서 §8의 공통 키로 화면 간 중복 캐시를 방지한다. */
export const queryKeys = {
  goals: () => ['goals'] as const,
  routines: () => ['routines'] as const,
  todos: (monthKey: string) => ['todos', monthKey] as const,
  routineLogs: (monthKey: string) => ['routineLogs', monthKey] as const,
  overdue: (today: string) => ['overdue', today] as const,
};
