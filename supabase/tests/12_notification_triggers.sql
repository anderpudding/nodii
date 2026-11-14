begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(32);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'),
  ('10000000-0000-4000-8000-000000000002', 'b@nodii.test'),
  ('10000000-0000-4000-8000-000000000003', 'c@nodii.test'),
  ('10000000-0000-4000-8000-000000000004', 'd@nodii.test'),
  ('10000000-0000-4000-8000-000000000005', 'e@nodii.test');

insert into public.social_profiles (user_id, handle, nickname) values
  ('10000000-0000-4000-8000-000000000001', 'test_a', 'A'),
  ('10000000-0000-4000-8000-000000000002', 'test_b', 'B'),
  ('10000000-0000-4000-8000-000000000003', 'test_c', 'C'),
  ('10000000-0000-4000-8000-000000000004', 'test_d', 'D');

insert into public.goals (id, user_id, name, color, sort_key, visibility) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'followers', '#4F7CFF', 'a1', 'followers'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'mutual', '#4F7CFF', 'a1', 'mutual'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'private', '#4F7CFF', 'a1', 'private');

select ok(not social_private.wants_notification('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'follow'), '본인은 수신하지 않음');
select ok(not social_private.wants_notification('10000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000002', 'follow'), '프로필 없는 사용자는 수신하지 않음');
update public.social_profiles set social_suspended_at = now() where user_id = '10000000-0000-4000-8000-000000000004';
select ok(not social_private.wants_notification('10000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'follow'), '정지된 사용자는 수신하지 않음');
update public.social_profiles set social_suspended_at = null where user_id = '10000000-0000-4000-8000-000000000004';

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';

insert into public.follows (follower_id, followee_id, today_sort_key) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

select is((select count(*) from public.notifications where kind = 'follow' and actor_id = '10000000-0000-4000-8000-000000000002'), 1::bigint, '새 팔로워 알림');

delete from public.follows where follower_id = '10000000-0000-4000-8000-000000000002' and followee_id = '10000000-0000-4000-8000-000000000001';

select is((select count(*) from public.notifications where kind = 'follow'), 0::bigint, '팔로워를 내보내면 알림 삭제');

insert into public.notification_prefs (user_id, new_follower) values (auth.uid(), false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';

insert into public.follows (follower_id, followee_id, today_sort_key) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003"}';

insert into public.follows (follower_id, followee_id, today_sort_key) values ('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'a1');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

select is((select count(*) from public.notifications where kind = 'follow'), 0::bigint, '새 팔로워 알림 끄기');

insert into public.follows (follower_id, followee_id, today_sort_key) values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a1');

insert into public.todos (id, user_id, goal_id, title, date, sort_key, is_done, done_at) values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Item', '2026-11-11', 'a1', false, null);

update public.todos set is_done = true, done_at = now() where id = '30000000-0000-4000-8000-000000000001';

reset role;

select is((select count(*) from public.notifications where kind = 'friend_done'), 0::bigint, '친구 완료 기본 끔');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';

insert into public.notification_prefs (user_id, friend_done) values (auth.uid(), true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003"}';

insert into public.notification_mutes values (auth.uid(), '10000000-0000-4000-8000-000000000001', true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

insert into public.todos (id, user_id, goal_id, title, date, sort_key, is_done, done_at) values (gen_random_uuid(), '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', 'Item', '2026-11-12', 'a1', true, now());

reset role;

select is((select count(*) from public.notifications where kind = 'friend_done'), 0::bigint, '나만 목표에 알림 없음');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

insert into public.todos (id, user_id, goal_id, title, date, sort_key, is_done, done_at) values (gen_random_uuid(), '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', 'Item', '2026-11-12', 'a1', true, now());

reset role;

select is((select count(*) from public.notifications where kind = 'friend_done' and recipient_id = '10000000-0000-4000-8000-000000000002' and date = '2026-11-12'), 1::bigint, '맞팔에게 완료 알림');

select is((select count(*) from public.notifications where kind = 'friend_done' and recipient_id = '10000000-0000-4000-8000-000000000003' and date = '2026-11-12'), 0::bigint, '맞팔 목표는 일반 팔로워 제외');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

insert into public.todos (id, user_id, goal_id, title, date, sort_key, is_done, done_at) values ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Item', '2026-11-12', 'a1', true, now());

reset role;

select results_eq(
  $$select count from public.notifications where kind = 'friend_done' and date = '2026-11-12' order by recipient_id$$,
  $$values (2), (1)$$, '한 줄에 각자 볼 수 있는 완료만 집계');

update public.notifications set updated_at = '2000-01-01' where kind = 'friend_done';

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

update public.todos set is_done = false, done_at = null where id = '30000000-0000-4000-8000-000000000002';

update public.todos set is_done = true, done_at = now() where id = '30000000-0000-4000-8000-000000000002';

reset role;

select results_eq(
  $$select count from public.notifications where kind = 'friend_done' and date = '2026-11-12' order by recipient_id$$,
  $$values (2), (1)$$, '완료 재체크 중복 집계 방지');

select is((select count(*) from public.notifications where kind = 'friend_done' and updated_at = '2000-01-01'), 2::bigint, '같은 숫자이면 시간 유지');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';

insert into public.notification_mutes values (auth.uid(), '10000000-0000-4000-8000-000000000001', false);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

insert into public.todos (id, user_id, goal_id, title, date, sort_key, is_done, done_at) values (gen_random_uuid(), '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Item', '2026-11-13', 'a1', true, now());

insert into public.routines (id, user_id, goal_id, title, freq, start_date, sort_key)
values ('40000000-0000-4000-8000-000000000001', auth.uid(), '20000000-0000-4000-8000-000000000001', 'Routine', 'daily', '2026-11-01', 'a1');
insert into public.routine_logs (routine_id, date, status) values ('40000000-0000-4000-8000-000000000001', '2026-11-14', 'skipped');

reset role;

select is((select count(*) from public.notifications where kind = 'friend_done' and recipient_id = '10000000-0000-4000-8000-000000000002' and date = '2026-11-13'), 0::bigint, '전체 켬 + 사람별 끔');

select is((select count(*) from public.notifications where kind = 'friend_done' and recipient_id = '10000000-0000-4000-8000-000000000003' and date = '2026-11-13'), 1::bigint, '전체 기본 끔 + 사람별 켬, 다른 날 새 줄');

select is((select count(*) from public.notifications where kind = 'friend_done' and date = '2026-11-14'), 0::bigint, '건너뛴 루틴에는 알림 없음');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

update public.routine_logs set status = 'done' where routine_id = '40000000-0000-4000-8000-000000000001' and date = '2026-11-14';

reset role;

select is((select count(*) from public.notifications where kind = 'friend_done' and recipient_id = '10000000-0000-4000-8000-000000000003' and date = '2026-11-14'), 1::bigint, '루틴 완료 전환');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003"}';

select lives_ok($$select public.react('30000000-0000-4000-8000-000000000002', null, null)$$, '완료 할 일에 반응');
select lives_ok($$select public.react(null, '40000000-0000-4000-8000-000000000001', '2026-11-14')$$, '완료 루틴에 반응');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

select is((select count(*) from public.notifications where kind = 'reaction' and todo_id = '30000000-0000-4000-8000-000000000002' and date = '2026-11-12'), 1::bigint, '할 일 반응 알림과 날짜');

select is((select count(*) from public.notifications where kind = 'reaction' and routine_id = '40000000-0000-4000-8000-000000000001' and date = '2026-11-14'), 1::bigint, '루틴 반응 알림과 날짜');

update public.todos set is_done = false, done_at = null where id = '30000000-0000-4000-8000-000000000002';

delete from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000001' and date = '2026-11-14';

select is((select count(*) from public.notifications where kind = 'reaction'), 2::bigint, '완료 취소에도 반응 알림 유지');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003"}';

delete from public.reactions where reactor_id = auth.uid() and todo_id = '30000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

select is((select count(*) from public.notifications where kind = 'reaction' and todo_id is not null), 0::bigint, '좋아요 취소 시 알림 삭제');

update public.notification_prefs set reaction = false where user_id = auth.uid();

update public.todos set is_done = true, done_at = now() where id = '30000000-0000-4000-8000-000000000002';

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';

select lives_ok($$select public.react('30000000-0000-4000-8000-000000000002', null, null)$$, '알림을 꺼도 반응 가능');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

select is((select count(*) from public.notifications where kind = 'reaction' and todo_id is not null), 0::bigint, '좋아요 알림 끄기');

insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), '10000000-0000-4000-8000-000000000003');

select is((select count(*) from public.notifications where actor_id = '10000000-0000-4000-8000-000000000003'), 0::bigint, '차단 상대의 알림 숨김');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003"}';

select throws_ok($$select public.react('30000000-0000-4000-8000-000000000002', null, null)$$, 'P0001', 'not_visible', '차단 사이 반응 거부');
select throws_ok($$insert into public.follows (follower_id, followee_id, today_sort_key) values (auth.uid(), '10000000-0000-4000-8000-000000000001', 'a1')$$, 'P0001', 'not_available', '차단 사이 팔로우 거부');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

insert into public.todos (id, user_id, goal_id, title, date, sort_key, is_done, done_at) values (gen_random_uuid(), '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Item', '2026-11-15', 'a1', true, now());

select throws_ok($$insert into public.notifications (recipient_id, actor_id, kind)
  values (auth.uid(), '10000000-0000-4000-8000-000000000002', 'follow')$$, '42501', null, '클라이언트가 직접 알림을 쓸 수 없음');
reset role;
select ok(not social_private.wants_notification('10000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', 'friend_done'), '차단 사이 알림 판정 거부');

select is((select count(*) from public.notifications where kind = 'friend_done' and date = '2026-11-15'), 0::bigint, '차단된 팔로워에게 친구 완료 알림 추가 없음');


-- 준비는 측정에서 제외하고, 미완료 행 1건을 UPDATE하는 데 든 시간을 잰다.
create temp table load_followers as select gen_random_uuid() as id, i from generate_series(1, 200) i;
insert into auth.users (id, email) select id, 'load' || i || '@nodii.test' from load_followers;
insert into public.social_profiles (user_id, handle, nickname)
  select id, 'load_user_' || i, 'Follower ' || i from load_followers;
insert into public.notification_prefs (user_id, friend_done) select id, true from load_followers;
insert into public.follows (follower_id, followee_id, today_sort_key)
  select id, '10000000-0000-4000-8000-000000000001', 'a1' from load_followers;
insert into public.todos (user_id, goal_id, title, date, sort_key)
  values ('10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'Measure', '2026-11-30', 'a1');
do $$
declare started timestamptz := clock_timestamp();
begin
  update public.todos set is_done = true, done_at = now() where user_id = '10000000-0000-4000-8000-000000000001' and date = '2026-11-30';
  raise notice 'S5 friend_done, 200 followers, completion UPDATE: % ms',
    round(extract(epoch from (clock_timestamp() - started)) * 1000, 3);
end;
$$;
select is((select count(*) from public.notifications n join load_followers l on l.id = n.recipient_id
  where n.kind = 'friend_done' and n.date = '2026-11-30' and n.count = 1), 200::bigint, '200명에게 각각 한 줄');
select * from finish();
rollback;
