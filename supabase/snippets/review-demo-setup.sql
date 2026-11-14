-- S7 A4: Run in Studio as postgres. Create the two dedicated Auth users first.
-- This resets their demo social state. Keep these accounts for review use only.
-- Sign in as A once to sync its time zone, then run shortly before review.
begin;

do $demo$
declare
  reviewer_a constant uuid := '[[TODO: UUID for appreview@nodii.app]]';
  reviewer_b constant uuid := '[[TODO: UUID for appreview2@nodii.app]]';
  demo_users constant uuid[] := array[reviewer_a, reviewer_b];
  demo_day date;
  demo_like uuid;
  demo_goal uuid;
begin
  if reviewer_a is null or reviewer_b is null or reviewer_a = reviewer_b
     or not exists (select 1 from auth.users where id = reviewer_a and email = 'appreview@nodii.app')
     or not exists (select 1 from auth.users where id = reviewer_b and email = 'appreview2@nodii.app')
  then
    raise exception 'Use the two dedicated App Review Auth UUIDs in the stated order.';
  end if;

  select (now() at time zone p.timezone)::date into strict demo_day
  from public.profiles p where p.id = reviewer_a;

  -- Remove edges to the demo accounts so fixture completions do not notify other users.
  delete from public.follows
    where follower_id = any(demo_users) or followee_id = any(demo_users);
  delete from public.blocks where blocker_id = any(demo_users);
  delete from public.reactions where reactor_id = any(demo_users);
  delete from public.notifications where recipient_id = any(demo_users);
  delete from public.notification_mutes where user_id = any(demo_users);
  delete from public.notification_prefs where user_id = any(demo_users);
  delete from public.push_tokens where user_id = any(demo_users);
  delete from public.push_throttle where recipient_id = any(demo_users);
  delete from public.reports
    where (reporter_id, target_user_id) in ((reviewer_a, reviewer_b), (reviewer_b, reviewer_a));
  delete from social_private.follow_rate_limits where user_id = any(demo_users);
  delete from public.handle_holds where released_by = any(demo_users);
  delete from public.invite_links where user_id = any(demo_users);
  delete from public.social_profiles where user_id = any(demo_users);

  insert into public.social_profiles (user_id, handle, nickname, bio) values
    (reviewer_a, 'nodii_review_a', 'Alex Review', 'This is the first Nodii demo profile.'),
    (reviewer_b, 'nodii_review_b', 'Jamie Review', 'A sample day with three goal visibility settings.');

  insert into public.notification_prefs (user_id, friend_done) values (reviewer_a, true);
  insert into public.follows (follower_id, followee_id, today_sort_key) values
    (reviewer_a, reviewer_b, 'a0'),
    (reviewer_b, reviewer_a, 'a0');

  -- Use stable IDs so reruns move only the sample rows, leaving all existing v2 rows intact.
  for demo_goal in
    with sample (visibility, name, color, sort_key) as (
      values ('followers', 'Daily life', '#4F7CFF', 'a0'),
             ('mutual', 'Learning', '#36A879', 'a1'),
             ('private', 'Personal notes', '#9B6CEF', 'a2')
    )
    insert into public.goals (id, user_id, name, color, sort_key, visibility)
    select md5(reviewer_b::text || ':s7-review:goal:' || visibility)::uuid,
           reviewer_b, name, color, sort_key, visibility::public.goal_visibility
    from sample
    on conflict (id) do update
      set name = excluded.name, color = excluded.color, sort_key = excluded.sort_key,
          visibility = excluded.visibility, archived_at = null, deleted_at = null
    returning id
  loop
    delete from public.routine_logs
      where routine_id = md5(demo_goal::text || ':routine')::uuid and user_id = reviewer_b;
  end loop;

  -- Insert as pending first; the normal completion triggers then rebuild the notifications.
  with sample (visibility, item, title, day_offset, sort_key) as (
    values
      ('followers', 1, 'Water the plants', 0, 'a0'),
      ('followers', 2, 'Pick up groceries', 0, 'a1'),
      ('followers', 3, 'Plan the week', -1, 'a0'),
      ('followers', 4, 'Fold the laundry', -1, 'a1'),
      ('mutual', 1, 'Read a chapter', 0, 'a0'),
      ('mutual', 2, 'Review vocabulary', 0, 'a1'),
      ('mutual', 3, 'Find a new book', -1, 'a0'),
      ('mutual', 4, 'Make study notes', -1, 'a1'),
      ('private', 1, 'Write a private note', 0, 'a0'),
      ('private', 2, 'Plan a personal project', 0, 'a1'),
      ('private', 3, 'Sort private notes', -1, 'a0'),
      ('private', 4, 'Check my personal list', -1, 'a1')
  )
  insert into public.todos (id, user_id, goal_id, title, date, sort_key)
  select md5(reviewer_b::text || ':s7-review:todo:' || visibility || ':' || item)::uuid,
         reviewer_b, md5(reviewer_b::text || ':s7-review:goal:' || visibility)::uuid,
         title, demo_day + day_offset, sort_key
  from sample
  on conflict (id) do update
    set goal_id = excluded.goal_id, title = excluded.title, date = excluded.date,
        sort_key = excluded.sort_key, is_done = false, done_at = null, deleted_at = null;

  update public.todos set is_done = true, done_at = now()
  where user_id = reviewer_b and id in (
    select md5(reviewer_b::text || ':s7-review:todo:' || visibility || ':' || item)::uuid
    from unnest(array['followers', 'mutual', 'private']) as v(visibility)
    cross join (values (1), (3)) as items(item)
  );

  with sample (visibility, title) as (
    values ('followers', 'Take a short walk'),
           ('mutual', 'Practice for ten minutes'),
           ('private', 'Check in with myself')
  ), routines as (
    insert into public.routines (id, user_id, goal_id, title, freq, start_date, sort_key)
    select md5(g.id::text || ':routine')::uuid, reviewer_b, g.id, sample.title,
           'daily', demo_day - 1, 'a2'
    from sample
    join public.goals g on g.id = md5(reviewer_b::text || ':s7-review:goal:' || sample.visibility)::uuid
    on conflict (id) do update
      set goal_id = excluded.goal_id, title = excluded.title, freq = excluded.freq, repeat_every = 1,
          by_weekday = null, by_monthday = null, start_date = excluded.start_date,
          sort_key = excluded.sort_key, end_date = null, deleted_at = null
    returning id
  )
  insert into public.routine_logs (routine_id, user_id, date, status)
  select id, reviewer_b, demo_day, 'done' from routines;

  -- Exercise the same visibility and completion checks as a like in the app.
  perform set_config('request.jwt.claim.sub', reviewer_a::text, true);
  demo_like := md5(reviewer_b::text || ':s7-review:todo:followers:1')::uuid;
  perform public.react(demo_like, null, null);

  -- Yesterday is available in the calendar; keep the notification feed focused on today.
  delete from public.notifications
  where recipient_id = reviewer_a and actor_id = reviewer_b
    and kind = 'friend_done' and date = demo_day - 1;
end
$demo$;

commit;

select nickname, handle, avatar_path is null as default_avatar
from public.social_profiles
where handle in ('nodii_review_a', 'nodii_review_b')
order by handle;

select source.handle as follower, target.handle as followee, f.show_on_today
from public.follows f
join public.social_profiles source on source.user_id = f.follower_id
join public.social_profiles target on target.user_id = f.followee_id
where source.handle in ('nodii_review_a', 'nodii_review_b')
  and target.handle in ('nodii_review_a', 'nodii_review_b')
order by follower;

select p.handle as recipient, n.kind, n.date, n.count
from public.notifications n
join public.social_profiles p on p.user_id = n.recipient_id
join public.social_profiles actor on actor.user_id = n.actor_id
where p.handle in ('nodii_review_a', 'nodii_review_b')
  and actor.handle in ('nodii_review_a', 'nodii_review_b')
order by recipient, n.kind, n.date;
