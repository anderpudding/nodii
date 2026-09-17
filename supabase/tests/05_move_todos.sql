begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(6);

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

insert into public.todos (id, user_id, goal_id, title, date, sort_key, deleted_at)
values ('30000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '삭제됨', '2026-09-16', 'a1', now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';


select lives_ok($q$select public.move_todos('[{"id":"30000000-0000-4000-8000-000000000001","sort_key":"a9"},{"id":"30000000-0000-4000-8000-000000000002","sort_key":"a9"},{"id":"30000000-0000-4000-8000-000000000003","sort_key":"a9"}]'::jsonb, '2026-09-17')$q$, '본인·남·삭제된 항목을 한 번에 전달');

select results_eq(
  $q$select date, sort_key from public.todos where id = '30000000-0000-4000-8000-000000000001'$q$,
  $e$values ('2026-09-17'::date, 'a9'::text collate "C")$e$, '본인 할 일 날짜·정렬 키 변경');

select results_eq(
  $q$select date, sort_key from public.todos where id = '30000000-0000-4000-8000-000000000003'$q$,
  $e$values ('2026-09-16'::date, 'a1'::text collate "C")$e$, '소프트 삭제된 할 일 무시');

reset role;

select results_eq(
  $q$select date, sort_key from public.todos where id = '30000000-0000-4000-8000-000000000002'$q$,
  $e$values ('2026-09-16'::date, 'a0'::text collate "C")$e$, '관리자 조회로 남의 할 일 변경 없음을 확인');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';


select lives_ok($q$select public.move_todos('[]'::jsonb, '2026-09-17')$q$, '빈 목록은 변경 없이 성공');

set local role anon;
set local request.jwt.claims = '{}';

select throws_ok(
  $q$select public.move_todos('[{"id":"30000000-0000-4000-8000-000000000001","sort_key":"a9"},{"id":"30000000-0000-4000-8000-000000000002","sort_key":"a9"},{"id":"30000000-0000-4000-8000-000000000003","sort_key":"a9"}]'::jsonb, '2026-09-17')$q$,
  '42501', 'permission denied for function move_todos', 'anon 이동 실행 권한 없음');

select * from finish();
rollback;
