-- SOC-50~53: 알림은 원본 행을 변경하는 트랜잭션 안에서만 만들고 지운다.
create function social_private.wants_notification(recipient uuid, actor uuid, kind text)
returns boolean language sql stable security definer set search_path = '' as $$
  select recipient <> actor
    and exists (
      select 1 from public.social_profiles p
      where p.user_id = recipient and p.social_suspended_at is null
    )
    and not social_private.is_blocked_between(recipient, actor)
    and case kind
      when 'follow' then coalesce(prefs.new_follower, true)
      when 'reaction' then coalesce(prefs.reaction, true)
      when 'friend_done' then coalesce(mute.friend_done, prefs.friend_done, false)
      else false
    end
  from (values (recipient)) as r(id)
  left join public.notification_prefs prefs on prefs.user_id = r.id
  left join public.notification_mutes mute on mute.user_id = r.id and mute.actor_id = actor;
$$;

create function social_private.notify_follow()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'DELETE' then
    delete from public.notifications n
    where n.kind = 'follow' and n.recipient_id = old.followee_id and n.actor_id = old.follower_id;
  elsif social_private.wants_notification(new.followee_id, new.follower_id, 'follow') then
    insert into public.notifications (recipient_id, actor_id, kind)
    values (new.followee_id, new.follower_id, 'follow');
  end if;
  return null;
end;
$$;

create function social_private.notify_reaction()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_date date;
begin
  if tg_op = 'DELETE' then
    delete from public.notifications n
    where n.kind = 'reaction' and n.recipient_id = old.owner_id and n.actor_id = old.reactor_id
      and (n.todo_id = old.todo_id or (n.routine_id = old.routine_id and n.date = old.date));
  elsif tg_op = 'UPDATE' then
    -- 루틴 분할로 옮긴 반응의 링크도 따라간다. 새 알림은 만들지 않는다.
    update public.notifications n set routine_id = new.routine_id
    where n.kind = 'reaction' and n.recipient_id = old.owner_id and n.actor_id = old.reactor_id
      and n.routine_id = old.routine_id and n.date = old.date;
  elsif social_private.wants_notification(new.owner_id, new.reactor_id, 'reaction') then
    v_date := new.date;
    if new.todo_id is not null then
      select t.date into v_date from public.todos t where t.id = new.todo_id;
    end if;
    insert into public.notifications (recipient_id, actor_id, kind, todo_id, routine_id, date)
    values (new.owner_id, new.reactor_id, 'reaction', new.todo_id, new.routine_id, v_date);
  end if;
  return null;
end;
$$;

create function social_private.notify_friend_done()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := new.user_id;
  v_date date := new.date;
  v_goal_id uuid;
begin
  if tg_table_name = 'todos' then
    if new.deleted_at is not null then return null; end if;
    v_goal_id := new.goal_id;
  else
    select r.goal_id into v_goal_id
    from public.routines r
    where r.id = new.routine_id and r.deleted_at is null
      and v_date >= r.start_date and (r.end_date is null or v_date <= r.end_date);
  end if;

  if not exists (
    select 1 from public.goals g
    where g.id = v_goal_id and g.deleted_at is null and g.visibility <> 'private'
  ) then return null; end if;

  -- 다른 기기에서 같은 날 서로 다른 항목을 동시에 끝내도 마지막 집계가 앞선 완료를 포함한다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('friend_done:' || v_actor::text || ':' || (v_date - date '2000-01-01')::text, 0)
  );

  with goals as materialized (
    -- can_view_goal과 같은 단계. 여기서는 auth.uid() 대신 알림을 받는 사람을 쓴다.
    select g.id, case g.visibility
      when 'public' then 0 when 'followers' then 1 when 'mutual' then 2 when 'private' then 3
    end as required_level
    from public.goals g where g.user_id = v_actor and g.deleted_at is null
  ), recipients as materialized (
    select f.follower_id, social_private.relation_level(f.follower_id, v_actor) as level
    from public.follows f
    where f.followee_id = v_actor
      and social_private.wants_notification(f.follower_id, v_actor, 'friend_done')
  ), completed as (
    select t.goal_id from public.todos t
    where t.user_id = v_actor and t.date = v_date and t.is_done and t.deleted_at is null
    union all
    select r.goal_id from public.routine_logs l
    join public.routines r on r.id = l.routine_id
    where l.user_id = v_actor and l.date = v_date and l.status = 'done' and r.deleted_at is null
      and l.date >= r.start_date and (r.end_date is null or l.date <= r.end_date)
  ), counts as (
    select g.required_level, count(*)::int as total
    from completed c join goals g on g.id = c.goal_id
    group by g.required_level
  )
  insert into public.notifications as n (recipient_id, actor_id, kind, date, count)
  select r.follower_id, v_actor, 'friend_done', v_date, sum(c.total)::int
  from recipients r join goals g on g.id = v_goal_id and g.required_level <= r.level
  join counts c on c.required_level <= r.level
  group by r.follower_id
  on conflict (recipient_id, actor_id, date) where kind = 'friend_done'
  do update set count = excluded.count,
    updated_at = case when excluded.count > n.count then clock_timestamp() else n.updated_at end
  where excluded.count <> n.count;

  return null;
end;
$$;

revoke execute on function social_private.wants_notification(uuid, uuid, text),
  social_private.notify_follow(), social_private.notify_reaction(), social_private.notify_friend_done()
  from public, anon, authenticated, service_role;

create trigger follows_notify after insert or delete on public.follows
  for each row execute function social_private.notify_follow();
create trigger reactions_notify after insert or delete on public.reactions
  for each row execute function social_private.notify_reaction();
create trigger reactions_move_notification after update of routine_id on public.reactions
  for each row when (old.routine_id is distinct from new.routine_id)
  execute function social_private.notify_reaction();

create trigger todos_notify_done_insert after insert on public.todos
  for each row when (new.is_done and new.deleted_at is null)
  execute function social_private.notify_friend_done();
create trigger todos_notify_done_update after update of is_done on public.todos
  for each row when (new.is_done and not old.is_done and new.deleted_at is null)
  execute function social_private.notify_friend_done();
create trigger routine_logs_notify_done_insert after insert on public.routine_logs
  for each row when (new.status = 'done')
  execute function social_private.notify_friend_done();
create trigger routine_logs_notify_done_update after update of status on public.routine_logs
  for each row when (new.status = 'done' and old.status <> 'done')
  execute function social_private.notify_friend_done();
