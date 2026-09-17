begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(8);

-- 각 파일은 독립 트랜잭션에서 실행되며 seed 데이터에 의존하지 않는다.
insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'),
  ('10000000-0000-4000-8000-000000000002', 'b@nodii.test');
update public.goals set id = '20000000-0000-4000-8000-000000000001' where user_id = '10000000-0000-4000-8000-000000000001';
update public.goals set id = '20000000-0000-4000-8000-000000000002' where user_id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';


select throws_ok(
  $q$update public.goals set archived_at = now() where id = '20000000-0000-4000-8000-000000000001'$q$,
  'P0001', 'at least one active goal is required', '마지막 활성 목표 archived_at = now() 거부');

select throws_ok(
  $q$update public.goals set deleted_at = now() where id = '20000000-0000-4000-8000-000000000001'$q$,
  'P0001', 'at least one active goal is required', '마지막 활성 목표 deleted_at = now() 거부');

select lives_ok($q$insert into public.goals (id, name, color, sort_key) values ('20000000-0000-4000-8000-000000000003', '두 번째', '#123456', 'a1')$q$, '두 번째 활성 목표 생성');

select lives_ok($q$update public.goals set archived_at = now() where id = '20000000-0000-4000-8000-000000000001'$q$, '활성 목표가 둘이면 하나 보관 가능');

select throws_ok(
  $q$update public.goals set deleted_at = now() where id = '20000000-0000-4000-8000-000000000003'$q$,
  'P0001', 'at least one active goal is required', '보관 목표는 활성 목표로 세지 않는다');

update public.goals set archived_at = null where id = '20000000-0000-4000-8000-000000000001';

select lives_ok($q$update public.goals set deleted_at = now() where id = '20000000-0000-4000-8000-000000000001'$q$, '활성 목표가 둘이면 하나 소프트 삭제 가능');

select throws_ok(
  $q$update public.goals set archived_at = now() where id = '20000000-0000-4000-8000-000000000003'$q$,
  'P0001', 'at least one active goal is required', '삭제 목표는 활성 목표로 세지 않는다');

select throws_ok(
  $$delete from public.goals where id = '20000000-0000-4000-8000-000000000003'$$,
  '42501', null, '직접 DELETE로 마지막 활성 목표 보호를 우회할 수 없다');

select * from finish();
rollback;
