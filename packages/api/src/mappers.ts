import { NOTIFICATION_KINDS, reactionTargetKey, visibleProfile } from '@nodii/core';
import type {
  Goal,
  Todo,
  Profile,
  Routine,
  RoutineLog,
  SocialProfile,
  TodayFollow,
  NotificationPrefs,
} from '@nodii/core';
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
export interface RoutineRecord extends Routine {
  updatedAt: string;
  deletedAt: string | null;
}
export interface RoutineLogRecord extends RoutineLog {
  updatedAt: string;
}
export type RoutineChanges = Partial<Omit<RoutineRecord, 'id' | 'updatedAt'>>;

/** 반복 규칙과 서버 갱신 시각을 같은 캐시에 보존한다 (ROUT-01). */
export function mapRoutine(row: Database['public']['Tables']['routines']['Row']): RoutineRecord {
  return {
    id: row.id,
    goalId: row.goal_id,
    title: row.title,
    freq: row.freq,
    repeatEvery: row.repeat_every,
    byWeekday: row.by_weekday,
    byMonthday: row.by_monthday,
    startDate: row.start_date,
    endDate: row.end_date,
    sortKey: row.sort_key,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
  };
}
/** DB의 문자열 상태를 검증해 잘못된 기록을 조용히 완료로 표시하지 않는다. */
export function mapRoutineLog(
  row: Database['public']['Tables']['routine_logs']['Row'],
): RoutineLogRecord {
  if (row.status !== 'done' && row.status !== 'skipped') throw new Error('invalid_log_status');
  return {
    routineId: row.routine_id,
    date: row.date,
    status: row.status,
    updatedAt: row.updated_at,
  };
}
/** 반복 종류 변경 시 쓰지 않는 배열도 null로 함께 지운다 (ROUT-08). */
export function routineChangesToRow(
  changes: RoutineChanges,
): Database['public']['Tables']['routines']['Update'] {
  return {
    goal_id: changes.goalId,
    title: changes.title,
    freq: changes.freq,
    repeat_every: changes.repeatEvery,
    by_weekday: changes.freq && changes.freq !== 'weekly' ? null : changes.byWeekday,
    by_monthday: changes.freq && changes.freq !== 'monthly' ? null : changes.byMonthday,
    start_date: changes.startDate,
    end_date: changes.endDate,
    sort_key: changes.sortKey,
    deleted_at: changes.deletedAt,
  };
}
/** 생성에도 클라이언트 UUID와 반복 종류별 null 규칙을 적용한다. */
export function routineToRow(routine: Routine): Database['public']['Tables']['routines']['Insert'] {
  return {
    id: routine.id,
    goal_id: routine.goalId,
    title: routine.title,
    freq: routine.freq,
    repeat_every: routine.repeatEvery,
    by_weekday: routine.freq === 'weekly' ? routine.byWeekday : null,
    by_monthday: routine.freq === 'monthly' ? routine.byMonthday : null,
    start_date: routine.startDate,
    end_date: routine.endDate,
    sort_key: routine.sortKey,
  };
}
/** 복합 키를 한 곳에서 변환해 완료·건너뛰기 요청을 일치시킨다. */
export function routineLogToRow(
  log: RoutineLog,
): Database['public']['Tables']['routine_logs']['Insert'] {
  return { routine_id: log.routineId, date: log.date, status: log.status };
}
export type GoalChanges = Partial<
  Pick<Goal, 'name' | 'color' | 'sortKey' | 'archivedAt' | 'visibility'>
>;
export type TodoChanges = Partial<
  Pick<TodoRecord, 'title' | 'isDone' | 'doneAt' | 'deletedAt' | 'date' | 'sortKey'>
>;

/** DB의 목표 행을 화면과 캐시가 공유하는 타입으로 바꾼다. */
export function mapGoal(row: Database['public']['Tables']['goals']['Row']): GoalRecord {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortKey: row.sort_key,
    archivedAt: row.archived_at,
    visibility: row.visibility,
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
    visibility: changes.visibility,
  };
}
/** 클라이언트 ID를 포함해 낙관적 행과 서버 행을 일치시킨다. */
export function goalToRow(
  goal: Goal,
  visibility: Profile['defaultVisibility'],
): Database['public']['Tables']['goals']['Insert'] {
  return {
    id: goal.id,
    name: goal.name,
    color: goal.color,
    sort_key: goal.sortKey,
    archived_at: goal.archivedAt,
    visibility,
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
    date: changes.date,
    sort_key: changes.sortKey,
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
    defaultVisibility:
      row.default_visibility === 'mutual' || row.default_visibility === 'followers'
        ? row.default_visibility
        : 'private',
  };
}

export const socialProfileFields =
  'user_id,handle,nickname,bio,avatar_path,searchable,handle_changed_at,auto_hidden_at,updated_at';

type SocialProfileRow = Omit<
  Database['public']['Tables']['social_profiles']['Row'],
  'created_at' | 'social_suspended_at'
>;
export type SocialProfilePatch = Partial<
  Pick<SocialProfile, 'handle' | 'nickname' | 'bio' | 'avatarPath' | 'searchable'>
>;

/** SOC-62: 다른 사람에게 숨긴 사진과 소개는 앱 캐시에 넣지 않는다. */
export function mapSocialProfile(row: SocialProfileRow, own: boolean): SocialProfile {
  const profile = visibleProfile(
    {
      userId: row.user_id,
      handle: row.handle,
      nickname: row.nickname,
      bio: row.bio,
      avatarPath: row.avatar_path,
      searchable: row.searchable,
      handleChangedAt: row.handle_changed_at,
      autoHiddenAt: row.auto_hidden_at,
      updatedAt: row.updated_at,
    },
    own,
  );
  return { ...profile, bio: profile.bio ?? '' };
}

type BlockedProfileResult =
  Database['public']['Functions']['my_blocked_profiles']['Returns'][number];
// RETURNS TABLE 타입 생성기는 nullable SELECT 표현식의 null 가능성을 표시하지 않는다.
type BlockedProfileRow = Omit<BlockedProfileResult, 'avatar_path'> & { avatar_path: string | null };

/** SOC-61: 차단 목록에는 RPC가 반환한 최소 정보만 둔다. */
export function mapBlockedProfile(row: BlockedProfileRow) {
  return {
    userId: row.user_id,
    handle: row.handle,
    nickname: row.nickname,
    avatarPath: row.avatar_path,
    blockedAt: row.blocked_at,
  };
}

/** 프로필 쓰기도 DB 열 이름을 매퍼에서만 조립한다. */
export function socialProfilePatchToRow(
  patch: SocialProfilePatch,
): Database['public']['Tables']['social_profiles']['Update'] {
  return {
    handle: patch.handle,
    nickname: patch.nickname,
    bio: patch.bio,
    avatar_path: patch.avatarPath,
    searchable: patch.searchable,
  };
}

/** SOC-36: 팔로우 관계와 오늘 줄 설정을 같은 타입으로 읽는다. */
export function mapTodayFollow(
  row: Pick<
    Database['public']['Tables']['follows']['Row'],
    'followee_id' | 'show_on_today' | 'today_sort_key' | 'created_at'
  >,
): TodayFollow {
  return {
    followeeId: row.followee_id,
    showOnToday: row.show_on_today,
    todaySortKey: row.today_sort_key,
    createdAt: row.created_at,
  };
}

/** SOC-36: 표시 설정 쓰기에서 팔로우 대상과 소유자를 바꾸지 않는다. */
export function todayFollowPatchToRow(
  patch: Partial<Pick<TodayFollow, 'showOnToday' | 'todaySortKey'>>,
) {
  return { show_on_today: patch.showOnToday, today_sort_key: patch.todaySortKey };
}

type NotificationRow = Database['public']['Tables']['notifications']['Row'];
type ReactionRow = Pick<
  Database['public']['Tables']['reactions']['Row'],
  'id' | 'todo_id' | 'routine_id' | 'date'
>;
type NotificationPrefsRow = Database['public']['Tables']['notification_prefs']['Row'];
type NotificationMuteRow = Database['public']['Tables']['notification_mutes']['Row'];

/** SOC-50: 화면의 알림 캐시는 DB 열 이름과 분리한다. */
export function mapNotification(row: NotificationRow) {
  const kind = NOTIFICATION_KINDS.find((value) => value === row.kind);
  if (!kind) return null;
  return {
    id: row.id,
    actorId: row.actor_id,
    kind,
    todoId: row.todo_id,
    routineId: row.routine_id,
    date: row.date,
    count: row.count,
    updatedAt: row.updated_at,
  };
}

/** SOC-40: 완료한 루틴의 반응은 날짜까지 포함한다. */
export function mapReaction(row: ReactionRow) {
  const target = row.todo_id
    ? { todoId: row.todo_id }
    : row.routine_id && row.date
      ? { routineId: row.routine_id, date: row.date }
      : null;
  return target ? { key: reactionTargetKey(target), id: row.id } : null;
}

/** SOC-53: 기존 즐겨찾기와 독립적으로 알림 종류별 값만 읽는다. */
export function mapNotificationPrefs(row: NotificationPrefsRow): NotificationPrefs {
  return { friendDone: row.friend_done, newFollower: row.new_follower, reaction: row.reaction };
}

/** SOC-53: 한 스위치를 바꿔도 다른 기기가 저장한 설정을 덮어쓰지 않는다. */
export function notificationPrefsToRow(values: Partial<NotificationPrefs>) {
  return {
    friend_done: values.friendDone,
    new_follower: values.newFollower,
    reaction: values.reaction,
  };
}

/** SOC-51: true와 false 모두 명시적인 예외로 보존한다. */
export function mapNotificationMute(row: NotificationMuteRow) {
  return { actorId: row.actor_id, friendDone: row.friend_done };
}
