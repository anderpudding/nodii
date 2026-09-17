begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(18);

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

update public.routines set end_date = '2026-10-31' where id = '40000000-0000-4000-8000-000000000001';
insert into public.routine_logs (routine_id, user_id, date, status) values
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-17', 'skipped'),
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '2026-09-20', 'done');
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';


select results_eq(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000001', '2026-09-17', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  $e$values ('40000000-0000-4000-8000-000000000003'::uuid)$e$, '분할은 클라이언트가 준 새 ID 반환');

select results_eq(
  $q$select end_date from public.routines where id = '40000000-0000-4000-8000-000000000001'$q$,
  $e$values ('2026-09-16'::date)$e$, '기존 루틴을 분할 전날 종료');

select results_eq(
  $q$select start_date, end_date, title, freq, repeat_every, by_weekday, sort_key from public.routines where id = '40000000-0000-4000-8000-000000000003'$q$,
  $e$values ('2026-09-17'::date, '2026-10-31'::date, '새 루틴'::text, 'weekly'::public.routine_freq, 2::smallint, array[1,3,5]::smallint[], 'a1'::text collate "C")$e$, '새 루틴은 분할일부터 새 규칙 적용 및 종료일·정렬 키 유지');

select results_eq(
  $q$select date, status from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000001' order by date$q$,
  $e$values ('2026-09-16'::date, 'done'::text)$e$, '과거 완료 기록은 기존 루틴에 남긴다');

select results_eq(
  $q$select date, status from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000003' order by date$q$,
  $e$values ('2026-09-17'::date, 'skipped'::text), ('2026-09-20'::date, 'done'::text)$e$, '분할 당일과 이후 로그는 FK를 만족하며 이동');

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000003', '2026-09-17', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  'P0001', 'no past occurrences: update the routine in place instead', '시작일이 분할일과 같으면 거부');

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000003', '2026-09-16', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  'P0001', 'no past occurrences: update the routine in place instead', '시작일이 분할일 이후면 거부');

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000001', '2026-09-17', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  'P0001', 'routine already ended', '이미 종료된 루틴 거부');

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000002', '2026-09-17', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  'P0001', 'routine not found', '남의 루틴은 찾을 수 없음');

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000099', '2026-09-17', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  'P0001', 'routine not found', '존재하지 않는 루틴 거부');

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000003', '2026-09-18', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000001'::uuid)$q$,
  '23505', null, '새 ID 중복 시 전체 분할 거부');

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000003', '2026-09-18', '새 루틴', '20000000-0000-4000-8000-000000000002', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000004'::uuid)$q$,
  '23503', null, '남의 목표로 분할 거부');

select results_eq(
  $q$select end_date from public.routines where id = '40000000-0000-4000-8000-000000000003'$q$,
  $e$values ('2026-10-31'::date)$e$, '실패한 분할은 기존 종료일 보존');

select results_eq(
  $q$select count(*) from public.routine_logs where routine_id = '40000000-0000-4000-8000-000000000003'$q$,
  $e$values (2::bigint)$e$, '실패한 분할은 로그 보존');

select lives_ok($q$select public.split_routine('40000000-0000-4000-8000-000000000003', '2026-09-18', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[])$q$, '빈 search_path에서도 기본 gen_random_uuid로 분할 가능');

select results_eq(
  $q$select count(*) from public.routines where user_id = '10000000-0000-4000-8000-000000000001'$q$,
  $e$values (3::bigint)$e$, '기본 UUID 분할이 새 행 생성');

update public.routines set deleted_at = now() where id = '40000000-0000-4000-8000-000000000001';

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000001', '2026-09-17', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  'P0001', 'routine not found', '소프트 삭제된 루틴 분할 거부');

set local role anon;
set local request.jwt.claims = '{}';

select throws_ok(
  $q$select public.split_routine('40000000-0000-4000-8000-000000000001', '2026-09-17', '새 루틴', '20000000-0000-4000-8000-000000000001', 'weekly', 2::smallint, array[1,3,5]::smallint[], null::smallint[], '40000000-0000-4000-8000-000000000003'::uuid)$q$,
  '42501', 'permission denied for function split_routine', 'anon 분할 실행 권한 없음');

select * from finish();
rollback;
