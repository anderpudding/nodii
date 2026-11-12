-- SOC-10~13, SOC-20~23, SOC-36, SOC-60: 관계에 따라 읽기만 허용한다.
create table public.follows (
  follower_id uuid not null references auth.users (id) on delete cascade,
  followee_id uuid not null references auth.users (id) on delete cascade,
  show_on_today boolean not null default true,
  today_sort_key text collate "C" not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id, follower_id);

create table public.blocks (
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id, blocker_id);

-- 언팔로우하거나 내보내도 직전 1시간의 요청이 한도에서 빠지지 않는다.
-- 사용자별 한 행만 유지하고 새 팔로우 때 만료한 시각을 버린다.
create table social_private.follow_rate_limits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  followed_at timestamptz[] not null
);

alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table social_private.follow_rate_limits enable row level security;
revoke all on table public.follows, public.blocks, social_private.follow_rate_limits
  from public, anon, authenticated;
grant select, delete on table public.follows, public.blocks to authenticated;
grant insert (follower_id, followee_id, show_on_today, today_sort_key),
  update (show_on_today, today_sort_key) on table public.follows to authenticated;
grant insert (blocker_id, blocked_id) on table public.blocks to authenticated;

create policy "read own follow edges" on public.follows for select to authenticated
  using ((select auth.uid()) in (follower_id, followee_id));
create policy "follow as self" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
create policy "update own follow preferences" on public.follows for update to authenticated
  using (follower_id = (select auth.uid())) with check (follower_id = (select auth.uid()));
create policy "unfollow or remove follower" on public.follows for delete to authenticated
  using ((select auth.uid()) in (follower_id, followee_id));

create policy "read own blocks" on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "block as self" on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy "remove own block" on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- 두 방향을 내부에서 확인한다. 직접 RPC로 차단 여부를 확인할 수 없게 한다(SOC-60).
create function social_private.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where blocker_id = a and blocked_id = b)
      or exists (select 1 from public.blocks where blocker_id = b and blocked_id = a);
$$;

create function social_private.relation_level(viewer uuid, owner uuid)
returns int language sql stable security definer set search_path = '' as $$
  select case
    when viewer is null or owner is null then -1
    when viewer = owner then 3
    when social_private.is_blocked_between(viewer, owner) then -1
    when exists (
      select 1 from public.social_profiles
      where user_id in (viewer, owner) and social_suspended_at is not null
    ) then -1
    when exists (select 1 from public.follows where follower_id = viewer and followee_id = owner)
    then 1 + (exists (select 1 from public.follows where follower_id = owner and followee_id = viewer))::int
    else 0
  end;
$$;

create function public.can_view_goal(p_goal_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.goals g
    where g.id = p_goal_id
      and social_private.relation_level(auth.uid(), g.user_id) >= case g.visibility
        when 'public' then 0 when 'followers' then 1 when 'mutual' then 2 when 'private' then 3
      end
  );
$$;

create function public.can_view_routine(p_routine_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.routines r
    where r.id = p_routine_id and public.can_view_goal(r.goal_id)
  );
$$;

alter policy "own social profile read" on public.social_profiles
  using (user_id = (select auth.uid()) or social_private.relation_level((select auth.uid()), user_id) >= 0);

-- 삭제 UPDATE도 Realtime에 도달해야 한다. 목록 요청 자체에서 deleted_at을 거른다.
create policy "read shared goals" on public.goals for select to authenticated
  using (user_id <> (select auth.uid()) and public.can_view_goal(id));
create policy "read shared todos" on public.todos for select to authenticated
  using (user_id <> (select auth.uid()) and public.can_view_goal(goal_id));
create policy "read shared routines" on public.routines for select to authenticated
  using (user_id <> (select auth.uid()) and public.can_view_goal(goal_id));
create policy "read shared done routine logs" on public.routine_logs for select to authenticated
  using (user_id <> (select auth.uid()) and status = 'done' and public.can_view_routine(routine_id));

create function social_private.lock_relationship(a uuid, b uuid)
returns void language sql set search_path = '' as $$
  select pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('social_pair:' || least(a, b)::text || ':' || greatest(a, b)::text, 0)
  );
$$;

create function social_private.guard_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  -- RLS 검사 전에 다른 사용자의 차단 상태를 탐색할 수 없게 한다.
  if current_setting('role') = 'authenticated' and new.follower_id is distinct from auth.uid() then
    raise insufficient_privilege;
  end if;
  -- 동시에 차단과 팔로우가 생겨도 차단된 관계가 남지 않는다.
  perform social_private.lock_relationship(new.follower_id, new.followee_id);
  if social_private.relation_level(new.follower_id, new.followee_id) < 0
     or (select count(*) from public.social_profiles where user_id in (new.follower_id, new.followee_id)) <> 2 then
    raise exception 'not_available';
  end if;
  return new;
end;
$$;

create function social_private.limit_follows()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_recent timestamptz[];
  v_at timestamptz;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('follow_limit:' || new.follower_id::text, 0));
  v_at := clock_timestamp();
  select array(
    select unnest(l.followed_at)
    from social_private.follow_rate_limits l
    where l.user_id = new.follower_id
  ) into v_recent;
  v_recent := array(select t from unnest(v_recent) as t where t > v_at - interval '1 hour');

  if cardinality(v_recent) >= 30 then
    raise exception 'rate_limited';
  end if;
  insert into social_private.follow_rate_limits (user_id, followed_at)
  values (new.follower_id, array_append(v_recent, v_at))
  on conflict (user_id) do update set followed_at = excluded.followed_at;
  return new;
end;
$$;

create function social_private.guard_block()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform social_private.lock_relationship(new.blocker_id, new.blocked_id);
  return new;
end;
$$;

create function social_private.remove_blocked_follows()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower_id, followee_id) in ((new.blocker_id, new.blocked_id), (new.blocked_id, new.blocker_id));
  return new;
end;
$$;

create trigger follows_guard before insert on public.follows
  for each row execute function social_private.guard_follow();
-- 충돌로 삽입되지 않은 행은 횟수에 넣지 않는다.
create trigger follows_limit after insert on public.follows
  for each row execute function social_private.limit_follows();
create trigger blocks_guard before insert on public.blocks
  for each row execute function social_private.guard_block();
create trigger blocks_remove_follows after insert on public.blocks
  for each row execute function social_private.remove_blocked_follows();

create function public.resolve_invite(p_token text)
returns uuid language sql stable security definer set search_path = '' as $$
  select l.user_id
  from public.invite_links l
  where l.token = p_token and social_private.relation_level(auth.uid(), l.user_id) >= 0
    and exists (select 1 from public.social_profiles p where p.user_id = l.user_id
                and p.social_suspended_at is null);
$$;

create function public.search_profiles(p_query text)
returns setof public.social_profiles language sql stable security invoker set search_path = '' as $$
  with input as (select public.normalize_text(btrim(p_query)) as query)
  select p.*
  from public.social_profiles p cross join input
  where char_length(input.query) >= 2 and p.searchable and p.social_suspended_at is null
    and (starts_with(p.handle, input.query) or strpos(public.normalize_text(p.nickname), input.query) > 0)
  order by (p.handle = input.query) desc, starts_with(p.handle, input.query) desc, p.handle
  limit 30;
$$;

revoke execute on function social_private.is_blocked_between(uuid, uuid),
  social_private.relation_level(uuid, uuid), social_private.lock_relationship(uuid, uuid),
  social_private.guard_follow(), social_private.limit_follows(), social_private.guard_block(),
  social_private.remove_blocked_follows() from public, anon, authenticated;
-- 정책에 저장된 함수 참조에는 EXECUTE가 필요하다. 스키마 USAGE는 부여하지 않는다.
grant execute on function social_private.relation_level(uuid, uuid) to authenticated;

revoke execute on function public.can_view_goal(uuid), public.can_view_routine(uuid),
  public.resolve_invite(text), public.search_profiles(text) from public, anon, authenticated;
grant execute on function public.can_view_goal(uuid), public.can_view_routine(uuid),
  public.resolve_invite(text), public.search_profiles(text) to authenticated;
