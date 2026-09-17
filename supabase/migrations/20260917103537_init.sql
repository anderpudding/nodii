-- ============ 공통: updated_at 자동 갱신 ============
create or replace function public.set_updated_at()
-- 역할별 search_path에 영향을 받지 않도록 보안 진단 경고를 해소한다.
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============ profiles ============
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  week_start   smallint not null default 0 check (week_start in (0, 1)),
  timezone     text not null default 'UTC',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 가입 시 profile + 기본 목표 자동 생성
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.goals (user_id, name, color, sort_key)
  values (new.id, '할 일', '#4F7CFF', 'a0');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ goals ============
create table public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 50),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_key    text collate "C" not null,
  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (id, user_id)
);
create index goals_user_idx on public.goals (user_id) where deleted_at is null;

-- ============ todos ============
create table public.todos (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id    uuid not null,
  title      text not null check (char_length(title) between 1 and 200),
  date       date not null,
  is_done    boolean not null default false,
  done_at    timestamptz,
  sort_key   text collate "C" not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  check (is_done = (done_at is not null))
);
create index todos_user_date_idx on public.todos (user_id, date) where deleted_at is null;

-- ============ routines ============
create type public.routine_freq as enum ('daily', 'weekly', 'monthly');

create table public.routines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id      uuid not null,
  title        text not null check (char_length(title) between 1 and 200),
  freq         public.routine_freq not null,
  repeat_every smallint not null default 1 check (repeat_every between 1 and 365),
  by_weekday   smallint[] check (by_weekday <@ array[0,1,2,3,4,5,6]::smallint[]),
  by_monthday  smallint[] check (by_monthday <@ array[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,
                                                      17,18,19,20,21,22,23,24,25,26,27,28,29,30,31]::smallint[]),
  start_date   date not null,
  end_date     date check (end_date is null or end_date >= start_date),
  sort_key     text collate "C" not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz,
  unique (id, user_id),
  foreign key (goal_id, user_id) references public.goals (id, user_id) on delete cascade,
  check ((freq = 'weekly')  = (coalesce(cardinality(by_weekday), 0)  > 0)),
  check ((freq = 'monthly') = (coalesce(cardinality(by_monthday), 0) > 0))
);
create index routines_user_idx on public.routines (user_id) where deleted_at is null;

-- ============ routine_logs ============
create table public.routine_logs (
  routine_id uuid not null,
  date       date not null,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  status     text not null check (status in ('done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (routine_id, date),
  foreign key (routine_id, user_id) references public.routines (id, user_id) on delete cascade
);
create index routine_logs_user_date_idx on public.routine_logs (user_id, date);

-- ============ updated_at 트리거 ============
create trigger profiles_updated_at     before update on public.profiles     for each row execute function public.set_updated_at();
create trigger goals_updated_at        before update on public.goals        for each row execute function public.set_updated_at();
create trigger todos_updated_at        before update on public.todos        for each row execute function public.set_updated_at();
create trigger routines_updated_at     before update on public.routines     for each row execute function public.set_updated_at();
create trigger routine_logs_updated_at before update on public.routine_logs for each row execute function public.set_updated_at();

-- ============ RLS: 본인 데이터만 ============
alter table public.profiles     enable row level security;
alter table public.goals        enable row level security;
alter table public.todos        enable row level security;
alter table public.routines     enable row level security;
alter table public.routine_logs enable row level security;

create policy "own profile" on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "own goals" on public.goals for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own todos" on public.todos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own routines" on public.routines for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own routine_logs" on public.routine_logs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Supabase의 자동 테이블 권한 설정과 무관하게 RLS 정책에 필요한 권한을 명시한다.
-- 기본 ALL 권한의 TRUNCATE는 RLS를 우회하므로 먼저 회수한다.
-- 목표·할 일·루틴은 소프트 삭제만 허용한다. 계정 삭제의 cascade에는 영향이 없다.
revoke all on table
  public.profiles, public.goals, public.todos, public.routines, public.routine_logs
  from anon, authenticated;
grant select, insert, update on table
  public.profiles, public.goals, public.todos, public.routines, public.routine_logs
  to authenticated;
grant delete on table public.routine_logs to authenticated;
grant select on table
  public.profiles, public.goals, public.todos, public.routines, public.routine_logs
  to anon;

-- ============ Realtime ============
alter publication supabase_realtime add table public.goals, public.todos, public.routines, public.routine_logs;
