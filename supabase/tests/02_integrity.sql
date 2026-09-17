begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(26);

-- 각 파일은 독립 트랜잭션에서 실행되며 seed 데이터에 의존하지 않는다.
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'),
  ('10000000-0000-4000-8000-000000000002', 'b@nodii.test');
update public.goals set id = '20000000-0000-4000-8000-000000000001' where user_id = '10000000-0000-4000-8000-000000000001';
update public.goals set id = '20000000-0000-4000-8000-000000000002' where user_id = '10000000-0000-4000-8000-000000000002';

insert into public.todos (id, user_id, goal_id, title, date, sort_key) values
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'A 할 일', '2026-09-16', 'a0'),
  ('30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'B 할 일', '2026-09-16', 'a0');
insert into public.routines (id, user_id, goal_id, title, freq, start_date, sort_key) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'A 루틴', 'daily', '2026-09-01', 'a1'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'B 루틴', 'daily', '2026-09-01', 'a1');
insert into public.routine_logs (routine_id, user_id, date, status) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-16', 'done'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', '2026-09-16', 'done');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';


select throws_ok(
  $q$insert into public.todos (goal_id, title, date, sort_key) values ('20000000-0000-4000-8000-000000000002', '남의 목표', '2026-09-17', 'a1')$q$,
  '23503', null, '본인 user_id라도 남의 goal_id는 복합 FK로 거부');

select throws_ok(
  $q$insert into public.routines (goal_id, title, freq, start_date, sort_key) values ('20000000-0000-4000-8000-000000000002', '남의 목표', 'daily', '2026-09-17', 'a1')$q$,
  '23503', null, '루틴에도 목표 소유권 복합 FK 적용');

select throws_ok(
  $q$insert into public.routine_logs (routine_id, date, status) values ('40000000-0000-4000-8000-000000000002', '2026-09-17', 'done')$q$,
  '23503', null, '루틴 기록의 소유권 복합 FK 적용');

select throws_ok(
  $q$update public.todos set title = '' where id = '30000000-0000-4000-8000-000000000001'$q$,
  '23514', null, 'todos 제목 0자 거부');

select throws_ok(
  $q$update public.todos set title = repeat('가', 201) where id = '30000000-0000-4000-8000-000000000001'$q$,
  '23514', null, 'todos 제목 201자 거부');

select lives_ok($q$update public.todos set title = repeat('가', 200) where id = '30000000-0000-4000-8000-000000000001'$q$, 'todos 한글 제목 200자 허용');

select throws_ok(
  $q$update public.routines set title = '' where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, 'routines 제목 0자 거부');

select throws_ok(
  $q$update public.routines set title = repeat('가', 201) where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, 'routines 제목 201자 거부');

select lives_ok($q$update public.routines set title = repeat('가', 200) where id = '40000000-0000-4000-8000-000000000001'$q$, 'routines 한글 제목 200자 허용');

select throws_ok(
  $q$update public.goals set name = '' where id = '20000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '빈 목표 이름 거부');

select throws_ok(
  $q$update public.goals set name = repeat('가', 51) where id = '20000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '목표 이름 51자 거부');

select throws_ok(
  $q$update public.goals set color = 'blue' where id = '20000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '잘못된 색상 거부');

select throws_ok(
  $q$update public.goals set color = '#12345G' where id = '20000000-0000-4000-8000-000000000001'$q$,
  '23514', null, 'HEX 범위 밖 색상 거부');

select lives_ok($q$update public.goals set color = '#aBc123' where id = '20000000-0000-4000-8000-000000000001'$q$, '대소문자 HEX 허용');

select throws_ok(
  $q$update public.todos set is_done = true where id = '30000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '완료 상태와 시각 불일치 거부: is_done = true');

select throws_ok(
  $q$update public.todos set done_at = now() where id = '30000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '완료 상태와 시각 불일치 거부: done_at = now()');

select lives_ok($q$update public.todos set is_done = true, done_at = now() where id = '30000000-0000-4000-8000-000000000001'$q$, '완료 상태와 시각 함께 변경 허용');

select throws_ok(
  $q$update public.routines set freq = 'weekly', by_weekday = '{}' where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '매주 빈 요일 거부');

select throws_ok(
  $q$update public.routines set freq = 'weekly', by_weekday = null where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '매주 null 요일 거부');

select throws_ok(
  $q$update public.routines set freq = 'weekly', by_weekday = array[7]::smallint[] where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '잘못된 요일 거부');

select throws_ok(
  $q$update public.routines set freq = 'monthly', by_monthday = '{}' where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '매월 빈 날짜 거부');

select throws_ok(
  $q$update public.routines set freq = 'monthly', by_monthday = array[32]::smallint[] where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '잘못된 월 날짜 거부');

select throws_ok(
  $q$update public.routines set repeat_every = 0 where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '반복 간격 0 거부');

select throws_ok(
  $q$update public.routines set end_date = '2026-08-31' where id = '40000000-0000-4000-8000-000000000001'$q$,
  '23514', null, '시작 이전 종료일 거부');

select lives_ok($q$update public.routines set freq = 'weekly', by_weekday = array[1,3,5]::smallint[] where id = '40000000-0000-4000-8000-000000000001'$q$, '매주 월수금 허용');

select lives_ok($q$update public.routines set freq = 'monthly', by_weekday = null, by_monthday = array[31]::smallint[] where id = '40000000-0000-4000-8000-000000000001'$q$, '매월 31일 허용');

select * from finish();
rollback;
