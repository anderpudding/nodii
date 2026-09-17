-- ============ 활성 목표 1개 이상 유지 (GOAL-07) ============
create or replace function public.ensure_active_goal()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.archived_at is not null or new.deleted_at is not null)
     and old.archived_at is null and old.deleted_at is null
  then
    -- GOAL-07: 서로 다른 기기가 각기 다른 목표를 동시에 보관해도 하나는 남긴다.
    -- 사용자별 잠금을 얻은 뒤 새 statement snapshot으로 남은 활성 목표를 확인한다.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(old.user_id::text, 0));
    if not exists (
       select 1 from public.goals g
        where g.user_id = new.user_id and g.id <> new.id
          and g.archived_at is null and g.deleted_at is null)
    then
      raise exception 'at least one active goal is required';
    end if;
  end if;
  return new;
end;
$$;

create trigger goals_ensure_active
  before update on public.goals
  for each row execute function public.ensure_active_goal();

-- ============ 루틴 분할: "오늘부터 적용" (ROUT-08 ②) ============
-- 기존 루틴은 p_from 전날에 종료하고, 새 규칙의 루틴을 p_from부터 시작한다.
-- p_from 이후 날짜에 이미 남긴 완료/건너뛰기 기록은 새 루틴으로 옮긴다.
create or replace function public.split_routine(
  p_routine_id   uuid,
  p_from         date,                    -- 클라이언트가 사용자 시간대로 계산한 "오늘"
  p_title        text,
  p_goal_id      uuid,
  p_freq         public.routine_freq,
  p_repeat_every smallint,
  p_by_weekday   smallint[],
  p_by_monthday  smallint[],
  p_new_id       uuid default gen_random_uuid()  -- 낙관적 업데이트용으로 클라이언트가 넘길 수 있음
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  v_old public.routines;
begin
  select * into v_old
    from public.routines
   where id = p_routine_id and deleted_at is null
     for update;

  if not found then
    raise exception 'routine not found';
  end if;
  if v_old.start_date >= p_from then
    raise exception 'no past occurrences: update the routine in place instead';
  end if;
  if v_old.end_date is not null and v_old.end_date < p_from then
    raise exception 'routine already ended';
  end if;

  insert into public.routines
    (id, user_id, goal_id, title, freq, repeat_every, by_weekday, by_monthday, start_date, end_date, sort_key)
  values
    (p_new_id, v_old.user_id, p_goal_id, p_title, p_freq, p_repeat_every, p_by_weekday, p_by_monthday,
     p_from, v_old.end_date, v_old.sort_key);

  update public.routine_logs
     set routine_id = p_new_id
   where routine_id = p_routine_id and date >= p_from;

  update public.routines
     set end_date = p_from - 1
   where id = p_routine_id;

  return p_new_id;
end;
$$;

-- ============ 할 일 여러 개를 한 날짜로 옮기기 (TODO-10, CAL-06) ============
-- p_moves: [{"id": "...", "sort_key": "..."}] · 정렬 키는 클라이언트가 목표별 맨 아래 위치로 계산
create or replace function public.move_todos(p_moves jsonb, p_date date)
returns void
language sql security invoker set search_path = '' as $$
  update public.todos t
     set date = p_date,
         sort_key = m.sort_key
    from jsonb_to_recordset(p_moves) as m(id uuid, sort_key text)
   where t.id = m.id and t.deleted_at is null;
$$;

revoke execute on function public.split_routine(uuid, date, text, uuid, public.routine_freq, smallint, smallint[], smallint[], uuid) from public, anon;
grant  execute on function public.split_routine(uuid, date, text, uuid, public.routine_freq, smallint, smallint[], smallint[], uuid) to authenticated;
revoke execute on function public.move_todos(jsonb, date) from public, anon;
grant  execute on function public.move_todos(jsonb, date) to authenticated;

-- ============ 앱 설정: 최소 지원 버전 (SET-05, v0.3 추가) ============
create table public.app_config (
  key        text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.app_config enable row level security;
-- 로그인 전에도 읽을 수 있어야 하므로 anon 포함, 쓰기 정책은 두지 않음 (대시보드/마이그레이션으로만 변경)
create policy "anyone can read config" on public.app_config for select to anon, authenticated using (true);
-- 기본 GRANT 설정에 기대지 않고 읽기만 허용한다.
revoke all on table public.app_config from anon, authenticated;
grant select on table public.app_config to anon, authenticated;
insert into public.app_config (key, value) values ('min_macos_app_version', '0.1.0');
