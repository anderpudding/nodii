-- SOC-40~42: 완료 기록이 지워져도 반응은 대상에 남긴다(D8).
create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  reactor_id uuid not null references auth.users (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  todo_id uuid references public.todos (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete cascade,
  date date,
  type text not null default 'like' check (type in ('like')),
  created_at timestamptz not null default now(),
  check (reactor_id <> owner_id),
  check ((todo_id is not null and routine_id is null and date is null)
      or (todo_id is null and routine_id is not null and date is not null))
);
create unique index reactions_todo_uniq on public.reactions (reactor_id, todo_id, type) where todo_id is not null;
create unique index reactions_routine_uniq on public.reactions (reactor_id, routine_id, date, type) where routine_id is not null;
create index reactions_owner_idx on public.reactions (owner_id, created_at desc);
create index reactions_reactor_idx on public.reactions (reactor_id);
create index reactions_todo_idx on public.reactions (todo_id) where todo_id is not null;
create index reactions_routine_date_idx on public.reactions (routine_id, date) where routine_id is not null;

alter table public.reactions enable row level security;
revoke all on table public.reactions from public, anon, authenticated;
grant select, delete on table public.reactions to authenticated;

grant execute on function social_private.is_blocked_between(uuid, uuid) to authenticated;
create policy "read sent or visible received reactions" on public.reactions for select to authenticated
  using (reactor_id = (select auth.uid()) or
    (owner_id = (select auth.uid()) and not social_private.is_blocked_between(owner_id, reactor_id)));
create policy "delete sent reactions" on public.reactions for delete to authenticated
  using (reactor_id = (select auth.uid()));

create function public.react(p_todo_id uuid, p_routine_id uuid, p_date date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_me uuid := auth.uid();
  v_owner uuid;
  v_done boolean;
  v_id uuid;
begin
  if v_me is null then
    raise exception 'authentication required';
  end if;

  if p_todo_id is not null and p_routine_id is null and p_date is null then
    select t.user_id, t.is_done into v_owner, v_done
    from public.todos t join public.goals g on g.id = t.goal_id
    where t.id = p_todo_id and t.deleted_at is null and g.deleted_at is null
      and public.can_view_goal(t.goal_id)
    for share of t;
  elsif p_todo_id is null and p_routine_id is not null and p_date is not null then
    -- 분할과 같은 루틴 행을 잠가 새 반응이 이미 옮긴 날짜에 뒤늦게 붙지 않게 한다.
    select r.user_id into v_owner
    from public.routines r join public.goals g on g.id = r.goal_id
    where r.id = p_routine_id and r.deleted_at is null and g.deleted_at is null
      and p_date >= r.start_date and (r.end_date is null or p_date <= r.end_date)
      and public.can_view_routine(r.id)
    for share of r;

    if v_owner is not null and v_owner <> v_me then
      select true into v_done
      from public.routine_logs l
      where l.routine_id = p_routine_id and l.date = p_date and l.status = 'done'
      for share;
    end if;
  end if;

  if v_owner is null then
    raise exception 'not_visible';
  elsif v_owner = v_me then
    raise exception 'own_item';
  elsif not coalesce(v_done, false) then
    raise exception 'not_done';
  end if;

  -- 같은 요청의 재시도는 기존 ID를 반환한다. 동시 취소로 기존 행이 사라지면 다시 삽입한다.
  loop
    insert into public.reactions (reactor_id, owner_id, todo_id, routine_id, date)
    values (v_me, v_owner, p_todo_id, p_routine_id, p_date)
    on conflict do nothing
    returning id into v_id;

    if v_id is not null then
      return v_id;
    end if;

    select id into v_id
    from public.reactions
    where reactor_id = v_me and type = 'like'
      and ((todo_id = p_todo_id) or (routine_id = p_routine_id and date = p_date));
    if v_id is not null then
      return v_id;
    end if;
  end loop;
end;
$$;

revoke execute on function public.react(uuid, uuid, date) from public, anon, authenticated;
grant execute on function public.react(uuid, uuid, date) to authenticated;

-- ROUT-08, SOC-42: 로그와 다른 사람이 남긴 반응을 같은 트랜잭션에서 옮긴다.
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
language plpgsql security definer set search_path = '' as $$
declare
  v_old public.routines;
begin
  select * into v_old
    from public.routines
   where id = p_routine_id and user_id = auth.uid() and deleted_at is null
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

  update public.reactions
     set routine_id = p_new_id
   where routine_id = p_routine_id and date >= p_from;

  update public.routines
     set end_date = p_from - 1
   where id = p_routine_id;

  return p_new_id;
end;
$$;

revoke execute on function public.split_routine(uuid, date, text, uuid, public.routine_freq, smallint, smallint[], smallint[], uuid) from public, anon, authenticated;
grant execute on function public.split_routine(uuid, date, text, uuid, public.routine_freq, smallint, smallint[], smallint[], uuid) to authenticated;
