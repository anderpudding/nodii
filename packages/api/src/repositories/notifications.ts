import {
  DEFAULT_NOTIFICATION_PREFS,
  reactionTargetKey,
  type ISODate,
  type NotificationPrefs,
  type ReactionTarget,
  type SocialProfile,
} from '@nodii/core';
import type { NodiiClient } from '../client';
import type { Database } from '../database.types';
import {
  mapNotification,
  mapNotificationMute,
  mapNotificationPrefs,
  mapReaction,
  mapSocialProfile,
  notificationPrefsToRow,
  socialProfileFields,
} from '../mappers';

type StoredNotification = NonNullable<ReturnType<typeof mapNotification>>;
export interface Notification extends StoredNotification {
  actor: SocialProfile | null;
  title: string | null;
  color: string | null;
}

const idsOf = (ids: readonly (string | null)[]) => [
  ...new Set(ids.filter((id): id is string => id !== null)),
];

/** SOC-50: 최근 100줄과 연결된 프로필, 항목 및 목표를 RLS 아래 일괄 조회한다. */
export async function fetchNotifications(
  client: NodiiClient,
  me: string,
  signal?: AbortSignal,
): Promise<Notification[]> {
  const query = client
    .from('notifications')
    .select('*')
    .eq('recipient_id', me)
    .order('updated_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(100);
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  if (error) throw error;
  const rows = data.flatMap((row) => mapNotification(row) ?? []);
  if (!rows.length) return [];
  const actors = idsOf(rows.map((row) => row.actorId));
  const todos = idsOf(rows.map((row) => row.todoId));
  const routines = idsOf(rows.map((row) => row.routineId));

  const profileQuery = client
    .from('social_profiles')
    .select(socialProfileFields)
    .in('user_id', actors);
  const todoQuery = client
    .from('todos')
    .select('id,title,date,goal_id')
    .eq('user_id', me)
    .is('deleted_at', null)
    .in('id', todos);
  const routineQuery = client
    .from('routines')
    .select('id,title,goal_id')
    .eq('user_id', me)
    .is('deleted_at', null)
    .in('id', routines);
  const [profiles, todoRows, routineRows] = await Promise.all([
    signal ? profileQuery.abortSignal(signal) : profileQuery,
    todos.length ? (signal ? todoQuery.abortSignal(signal) : todoQuery) : null,
    routines.length ? (signal ? routineQuery.abortSignal(signal) : routineQuery) : null,
  ]);
  if (profiles.error) throw profiles.error;
  if (todoRows?.error) throw todoRows.error;
  if (routineRows?.error) throw routineRows.error;

  const items = [...(todoRows?.data ?? []), ...(routineRows?.data ?? [])];
  const goalIds = idsOf(items.map((item) => item.goal_id));
  const colors = new Map<string, string>();
  if (goalIds.length) {
    const goalQuery = client
      .from('goals')
      .select('id,color')
      .eq('user_id', me)
      .is('deleted_at', null)
      .in('id', goalIds);
    const result = await (signal ? goalQuery.abortSignal(signal) : goalQuery);
    if (result.error) throw result.error;
    for (const goal of result.data) colors.set(goal.id, goal.color);
  }
  const byActor = new Map(profiles.data.map((row) => [row.user_id, mapSocialProfile(row, false)]));
  const byTodo = new Map(todoRows?.data?.map((row) => [row.id, row]));
  const byRoutine = new Map(routineRows?.data?.map((row) => [row.id, row]));
  // 친구 완료 항목은 펼치는 순간의 친구 하루로 읽는다. 묶음 행에는 항목 ID가 없다.
  return rows.map((row) => {
    const todo = row.todoId ? byTodo.get(row.todoId) : undefined;
    const item = todo ?? (row.routineId ? byRoutine.get(row.routineId) : undefined);
    const color = (item && colors.get(item.goal_id)) ?? null;
    return {
      ...row,
      date: todo?.date ?? row.date,
      title: color && item ? item.title : null,
      color,
      actor: byActor.get(row.actorId) ?? null,
    };
  });
}

/** SOC-40: S1 RPC가 현재 완료와 공개 범위를 확인한다. */
export async function react(client: NodiiClient, target: ReactionTarget) {
  // SQL 인자는 nullable이지만 Supabase의 함수 타입 생성기는 null을 포함하지 않는다.
  const args =
    'todoId' in target
      ? { p_todo_id: target.todoId, p_routine_id: null, p_date: null }
      : { p_todo_id: null, p_routine_id: target.routineId, p_date: target.date };
  const { data, error } = await client
    .rpc('react', args as unknown as Database['public']['Functions']['react']['Args'])
    .retry(false);
  if (error) throw error;
  return data;
}

/** SOC-40: 보낸 반응만 삭제할 수 있다. */
export async function unreact(client: NodiiClient, me: string, reactionId: string) {
  const { error } = await client
    .from('reactions')
    .delete()
    .eq('reactor_id', me)
    .eq('id', reactionId);
  if (error) throw error;
}

export interface ReactionTargets {
  todoIds: readonly string[];
  routineDates: readonly { routineId: string; date: ISODate }[];
}
export type MyReactions = Record<string, string>;

/** SOC-40: 한 화면에 표시하는 대상의 상태를 유형별로 묶어 읽는다. */
export async function fetchMyReactions(
  client: NodiiClient,
  me: string,
  targets: ReactionTargets,
  signal: AbortSignal,
): Promise<MyReactions> {
  const todos = idsOf(targets.todoIds);
  const routineIds = idsOf(targets.routineDates.map((item) => item.routineId));
  const dates = idsOf(targets.routineDates.map((item) => item.date));
  const keys = new Set([
    ...todos.map((todoId) => reactionTargetKey({ todoId })),
    ...targets.routineDates.map(reactionTargetKey),
  ]);
  const batches = (ids: string[]) =>
    Array.from({ length: Math.ceil(ids.length / 100) }, (_, index) =>
      ids.slice(index * 100, (index + 1) * 100),
    );
  const base = () =>
    client
      .from('reactions')
      .select('id,todo_id,routine_id,date')
      .eq('reactor_id', me)
      .abortSignal(signal);
  const results = await Promise.all([
    ...batches(todos).map((ids) => base().in('todo_id', ids)),
    ...batches(routineIds).map((ids) => base().in('routine_id', ids).in('date', dates)),
  ]);
  const reactions: MyReactions = {};
  for (const result of results) {
    if (result.error) throw result.error;
    for (const row of result.data) {
      const reaction = mapReaction(row);
      if (reaction && keys.has(reaction.key)) reactions[reaction.key] = reaction.id;
    }
  }
  return reactions;
}

/** SOC-53: 행이 아직 없는 계정에도 기본 설정이 적용된다. */
export async function fetchNotificationPrefs(client: NodiiClient, me: string, signal: AbortSignal) {
  const { data, error } = await client
    .from('notification_prefs')
    .select('*')
    .eq('user_id', me)
    .abortSignal(signal)
    .maybeSingle();
  if (error) throw error;
  return data ? mapNotificationPrefs(data) : DEFAULT_NOTIFICATION_PREFS;
}

/** SOC-53: 누락된 열은 DB 기본값을 쓰고 기존 행에서는 바꾼 열만 저장한다. */
export async function updateNotificationPrefs(
  client: NodiiClient,
  me: string,
  patch: Partial<NotificationPrefs>,
) {
  const { data, error } = await client
    .from('notification_prefs')
    .upsert(
      { user_id: me, ...notificationPrefsToRow(patch), updated_at: new Date().toISOString() },
      { defaultToNull: false },
    )
    .select('*')
    .single();
  if (error) throw error;
  return mapNotificationPrefs(data);
}

/** SOC-51: 켜기와 끄기 예외를 모두 조회한다. */
export async function fetchNotificationMutes(client: NodiiClient, me: string, signal: AbortSignal) {
  const { data, error } = await client
    .from('notification_mutes')
    .select('*')
    .eq('user_id', me)
    .abortSignal(signal);
  if (error) throw error;
  return data.map(mapNotificationMute);
}

/** SOC-51: 전체 설정과 다른 값만 사람별로 남긴다. */
export async function setNotificationMute(
  client: NodiiClient,
  me: string,
  actorId: string,
  friendDone: boolean,
) {
  const { error } = await client
    .from('notification_mutes')
    .upsert({ user_id: me, actor_id: actorId, friend_done: friendDone });
  if (error) throw error;
}

/** SOC-51: 전체 설정을 다시 따를 때는 예외 행을 지운다. */
export async function clearNotificationMute(client: NodiiClient, me: string, actorId: string) {
  const { error } = await client
    .from('notification_mutes')
    .delete()
    .eq('user_id', me)
    .eq('actor_id', actorId);
  if (error) throw error;
}
