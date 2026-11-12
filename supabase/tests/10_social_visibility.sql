begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(50);

-- A와 B는 소셜 가입, C는 소셜 미가입 상태다.
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'), ('10000000-0000-4000-8000-000000000002', 'b@nodii.test'), ('10000000-0000-4000-8000-000000000003', 'c@nodii.test');
insert into public.social_profiles (user_id, handle, nickname) values
  ('10000000-0000-4000-8000-000000000001', 'reader', 'Reader'), ('10000000-0000-4000-8000-000000000002', 'writer', 'Writer');
insert into public.goals (id, user_id, name, color, sort_key, visibility) values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'Private goal', '#4F7CFF', 'a1', 'private'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'Followers goal', '#4F7CFF', 'a2', 'followers'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Mutual goal', '#4F7CFF', 'a3', 'mutual'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000002', 'Public goal', '#4F7CFF', 'a4', 'public'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', 'Own public goal', '#4F7CFF', 'a1', 'public');
insert into public.todos (id, user_id, goal_id, title, date, sort_key)
values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Todo', '2026-11-12', 'a0');
insert into public.routines (id, user_id, goal_id, title, freq, start_date, sort_key)
values ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'Routine', 'daily', '2026-11-01', 'a1');
insert into public.routine_logs (routine_id, user_id, date, status) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '2026-11-12', 'done'),
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', '2026-11-13', 'skipped');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';

select is_empty($$select id from public.goals where id = '20000000-0000-4000-8000-000000000001'$$, 'private 목표 숨김');
select is_empty($$select id from public.todos where id = '30000000-0000-4000-8000-000000000001'$$, 'private 할 일 숨김');
select is_empty($$select id from public.routines where id = '40000000-0000-4000-8000-000000000001'$$, 'private 루틴 숨김');
select is_empty($$select date from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000001'$$, 'private 로그 숨김');
select is((select count(*) from public.goals where id = '20000000-0000-4000-8000-000000000004'), 1::bigint, '관계 없이 public 읽기');
select ok(public.can_view_goal('20000000-0000-4000-8000-000000000004') and not public.can_view_goal('20000000-0000-4000-8000-000000000001'), '목표 함수도 같은 공개 범위 적용');
select ok(not public.can_view_routine('40000000-0000-4000-8000-000000000001'), 'private 루틴 함수 거부');
select throws_ok($$update public.profiles set default_visibility = 'public' where id = '10000000-0000-4000-8000-000000000001'$$,
  '23514', null, '기본 공개 범위 public 거부');
select throws_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'a0')$$, 'P0001', 'not_available', '소셜에 가입하지 않은 대상 팔로우 거부');
select throws_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'a0')$$, '42501', null, '가짜 팔로우 요청은 대상 상태를 확인하기 전에 거부');
select lives_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0')$$, '본인 팔로우 추가');
select is((select count(*) from public.goals where id = '20000000-0000-4000-8000-000000000002'), 1::bigint, '팔로워 목표 읽기');
select is_empty($$select id from public.goals where id = '20000000-0000-4000-8000-000000000003'$$, '단방향 관계에서 맞팔 목표 숨김');
select lives_ok($$update public.follows set show_on_today = false, today_sort_key = 'a1'
  where follower_id = '10000000-0000-4000-8000-000000000001'$$, '팔로우한 사람이 두 표시 설정을 수정');
select throws_ok($$update public.follows set followee_id = '10000000-0000-4000-8000-000000000003' where follower_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', null, '팔로우 대상 변경 거부');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select results_eq($$select show_on_today, today_sort_key collate "default" from public.follows where follower_id = '10000000-0000-4000-8000-000000000001'$$,
  $$values (false, 'a1'::text)$$, '두 설정이 실제로 수정됨');
select is_empty($$update public.follows set show_on_today = true, today_sort_key = 'a2'
  where follower_id = '10000000-0000-4000-8000-000000000001' returning 1$$, '팔로우 대상의 수정 거부');
insert into public.follows (follower_id, followee_id, today_sort_key) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'a0');
update public.todos set goal_id = '20000000-0000-4000-8000-000000000003' where id = '30000000-0000-4000-8000-000000000001';
update public.routines set goal_id = '20000000-0000-4000-8000-000000000003' where id = '40000000-0000-4000-8000-000000000001';

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select is((select count(*) from public.goals where id = '20000000-0000-4000-8000-000000000003'), 1::bigint, '맞팔 목표 읽기');
select is((select count(*) from public.todos where id = '30000000-0000-4000-8000-000000000001'), 1::bigint, '맞팔 할 일 읽기');
select is((select count(*) from public.routines where id = '40000000-0000-4000-8000-000000000001'), 1::bigint, '맞팔 루틴 읽기');
select ok(public.can_view_routine('40000000-0000-4000-8000-000000000001'), '맞팔 루틴 함수 허용');
select results_eq($$select status from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000001'$$,
  $$values ('done'::text)$$, '완료 로그만 보이고 건너뛰기는 숨김');

-- 읽을 수 있는 친구 행도 쓰기는 거부한다.
select throws_ok($$insert into public.goals (user_id, name, color, sort_key)
  values ('10000000-0000-4000-8000-000000000002', 'Foreign goal', '#4F7CFF', 'a5')$$, '42501', null, '친구 목표 INSERT 거부');
select throws_ok($$insert into public.todos (user_id, goal_id, title, date, sort_key)
  values ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'Foreign todo', '2026-11-15', 'a0')$$, '42501', null, '친구 할 일 INSERT 거부');
select throws_ok($$insert into public.routines (user_id, goal_id, title, freq, start_date, sort_key)
  values ('10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', 'Foreign routine', 'daily', '2026-11-15', 'a0')$$, '42501', null, '친구 루틴 INSERT 거부');
select throws_ok($$insert into public.routine_logs (user_id, routine_id, date, status)
  values ('10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '2026-11-15', 'done')$$, '42501', null, '친구 로그 INSERT 거부');
select is_empty($$update public.goals set name = 'Changed' where id = '20000000-0000-4000-8000-000000000003' returning 1$$, '친구 목표 UPDATE 거부');
select is_empty($$update public.todos set title = 'Changed' where id = '30000000-0000-4000-8000-000000000001' returning 1$$, '친구 할 일 UPDATE 거부');
select is_empty($$update public.routines set title = 'Changed' where id = '40000000-0000-4000-8000-000000000001' returning 1$$, '친구 루틴 UPDATE 거부');
select is_empty($$update public.routine_logs set status = 'skipped' where routine_id = '40000000-0000-4000-8000-000000000001' returning 1$$,
  '친구 로그 UPDATE 거부');
select throws_ok($$delete from public.goals where id = '20000000-0000-4000-8000-000000000003'$$, '42501', null, '친구 목표 DELETE 거부');
select throws_ok($$delete from public.todos where id = '30000000-0000-4000-8000-000000000001'$$, '42501', null, '친구 할 일 DELETE 거부');
select throws_ok($$delete from public.routines where id = '40000000-0000-4000-8000-000000000001'$$, '42501', null, '친구 루틴 DELETE 거부');
select is_empty($$delete from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000001' returning 1$$, '친구 로그 DELETE 거부');

delete from public.follows where follower_id = '10000000-0000-4000-8000-000000000001';
select is_empty($$select id from public.goals where id in ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002')$$, '언팔 직후 공개 범위 축소');
insert into public.follows (follower_id, followee_id, today_sort_key) values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
delete from public.follows where follower_id = '10000000-0000-4000-8000-000000000001';
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select is_empty($$select id from public.goals where id in ('20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002')$$, '팔로워 내보내기 직후 공개 범위 축소');
insert into public.follows (follower_id, followee_id, today_sort_key) values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0');

-- B → A 차단 한 건이 두 방향의 조회를 모두 막는다.
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select lives_ok($$insert into public.blocks (blocker_id, blocked_id) values ('10000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001')$$, '본인 차단 추가');
select is((select count(*) from public.blocks), 1::bigint, '차단한 사람이 차단 목록 읽기');
select is_empty($$select id from public.goals where id = '20000000-0000-4000-8000-000000000005'$$, '차단한 사람도 상대의 public 목표 접근 불가');
select is_empty($$select 1 from public.follows$$, '차단하면 두 방향의 follows 삭제');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select is_empty($$select id from public.goals where user_id = '10000000-0000-4000-8000-000000000002'$$, '차단당한 사람에게 모든 범위 숨김');
select is_empty($$select id from public.todos where user_id = '10000000-0000-4000-8000-000000000002'$$, '차단당한 사람에게 할 일 숨김');
select is_empty($$select id from public.routines where user_id = '10000000-0000-4000-8000-000000000002'$$, '차단당한 사람에게 루틴 숨김');
select is_empty($$select date from public.routine_logs where user_id = '10000000-0000-4000-8000-000000000002'$$, '차단당한 사람에게 루틴 기록 숨김');
select is_empty($$select 1 from public.blocks$$, '차단당한 사람은 차단 행 조회 불가');
select throws_ok($$insert into public.follows (follower_id, followee_id, today_sort_key)
  values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'a0')$$, 'P0001', 'not_available', '차단 중 팔로우 거부');
select throws_ok($$select social_private.is_blocked_between('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002')$$,
  '42501', null, '내부 함수로 차단 사실 조회 거부');

reset role;
delete from public.blocks;
update public.social_profiles set social_suspended_at = now() where user_id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
select is_empty($$select id from public.goals where user_id = '10000000-0000-4000-8000-000000000002'$$, '정지된 사용자의 목표 숨김');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select is_empty($$select id from public.goals where id = '20000000-0000-4000-8000-000000000005'$$, '정지된 사용자는 다른 사람의 목표 접근 불가');
select is((select count(*) from public.goals where id = '20000000-0000-4000-8000-000000000004'), 1::bigint, '정지된 사용자는 자기 목표 접근 가능');

select * from finish();
rollback;
