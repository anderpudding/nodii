/** 'YYYY-MM-DD' 형식의 로컬 달력 날짜 (시각 없음, 설계서 §4.2) */
export type ISODate = string;

export interface Goal {
  id: string;
  name: string;
  /** #RRGGBB */
  color: string;
  sortKey: string;
  archivedAt: string | null;
}

export interface Todo {
  id: string;
  goalId: string;
  title: string;
  date: ISODate;
  isDone: boolean;
  sortKey: string;
}

export type RoutineFreq = 'daily' | 'weekly' | 'monthly';

export interface Routine {
  id: string;
  goalId: string;
  title: string;
  freq: RoutineFreq;
  /** N일/주/월마다 */
  repeatEvery: number;
  /** 0=일 … 6=토 (weekly일 때만) */
  byWeekday: number[] | null;
  /** 1…31 (monthly일 때만) */
  byMonthday: number[] | null;
  startDate: ISODate;
  endDate: ISODate | null;
  sortKey: string;
}

export type RoutineLogStatus = 'done' | 'skipped';

export interface RoutineLog {
  routineId: string;
  date: ISODate;
  status: RoutineLogStatus;
}

/** 화면에 그리는 한 줄: 할 일과 루틴을 합친 형태 */
export type DayItem =
  | { kind: 'todo'; goalId: string; sortKey: string; todo: Todo }
  | { kind: 'routine'; goalId: string; sortKey: string; routine: Routine; log: RoutineLog | null };

export interface DayGoalGroup {
  goal: Goal;
  items: DayItem[];
  canAdd: boolean;
}

export interface DaySummary {
  total: number;
  remaining: number;
}

/** 사용자 설정은 서버 상태로만 보관한다. */
export interface Profile {
  id: string;
  displayName: string | null;
  timezone: string;
  weekStart: 0 | 1;
}
