import type { Goal, Todo, Profile } from '@nodii/core';
import type { Database } from './database.types';

/** 동기화용 메타데이터는 도메인 타입을 오염시키지 않고 API 캐시에 보존한다. */
export interface GoalRecord extends Goal {
  updatedAt: string;
  deletedAt: string | null;
}
export interface TodoRecord extends Todo {
  updatedAt: string;
  deletedAt: string | null;
  doneAt: string | null;
}
export type GoalChanges = Partial<Pick<Goal, 'name' | 'color' | 'sortKey' | 'archivedAt'>>;
export type TodoChanges = Partial<Pick<TodoRecord, 'title' | 'isDone' | 'doneAt' | 'deletedAt'>>;

/** DB의 목표 행을 화면과 캐시가 공유하는 타입으로 바꾼다. */
export function mapGoal(row: Database['public']['Tables']['goals']['Row']): GoalRecord {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortKey: row.sort_key,
    archivedAt: row.archived_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
/** DB의 할 일 행에서 서버 시각도 보존한다. */
export function mapTodo(row: Database['public']['Tables']['todos']['Row']): TodoRecord {
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    date: row.date,
    isDone: row.is_done,
    sortKey: row.sort_key,
    doneAt: row.done_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
/** 쓰기에서도 snake_case 변환을 이 경계에만 둔다. */
export function goalChangesToRow(
  changes: GoalChanges,
): Database['public']['Tables']['goals']['Update'] {
  return {
    name: changes.name,
    color: changes.color,
    sort_key: changes.sortKey,
    archived_at: changes.archivedAt,
  };
}
/** 클라이언트 ID를 포함해 낙관적 행과 서버 행을 일치시킨다. */
export function goalToRow(goal: Goal): Database['public']['Tables']['goals']['Insert'] {
  return {
    id: goal.id,
    name: goal.name,
    color: goal.color,
    sort_key: goal.sortKey,
    archived_at: goal.archivedAt,
  };
}
/** 완료 상태와 완료 시각을 한 요청으로 보낸다. */
export function todoChangesToRow(
  changes: TodoChanges,
): Database['public']['Tables']['todos']['Update'] {
  return {
    title: changes.title,
    is_done: changes.isDone,
    done_at: changes.doneAt,
    deleted_at: changes.deletedAt,
  };
}
/** 할 일 생성에 클라이언트 UUID와 달력 날짜를 그대로 사용한다. */
export function todoToRow(todo: Todo): Database['public']['Tables']['todos']['Insert'] {
  return {
    id: todo.id,
    goal_id: todo.goalId,
    title: todo.title,
    date: todo.date,
    is_done: todo.isDone,
    sort_key: todo.sortKey,
  };
}

/** DB 열 이름을 도메인 이름으로 변환하는 유일한 경계다. */
export function mapProfile(row: Database['public']['Tables']['profiles']['Row']): Profile {
  if (row.week_start !== 0 && row.week_start !== 1)
    throw new Error('지원하지 않는 주 시작 요일입니다.');
  return {
    id: row.id,
    displayName: row.display_name,
    timezone: row.timezone,
    weekStart: row.week_start,
  };
}
