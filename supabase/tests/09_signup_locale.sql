begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(14);

-- AUTH-04 / SET-06: 원본 카탈로그나 기존 사용자 데이터를 바꾸지 않고 신규 행만 현지화한다.
insert into auth.users (id, email, raw_user_meta_data) values
  ('aaaaaaaa-0000-4000-8000-000000000011', 'signup-en@nodii.test', '{"signup_locale":"en"}'),
  ('aaaaaaaa-0000-4000-8000-000000000012', 'signup-ko@nodii.test', '{"signup_locale":"ko"}'),
  ('aaaaaaaa-0000-4000-8000-000000000013', 'signup-unknown@nodii.test', '{"signup_locale":"fr"}'),
  ('aaaaaaaa-0000-4000-8000-000000000014', 'signup-null@nodii.test', '{"signup_locale":null}'),
  ('aaaaaaaa-0000-4000-8000-000000000015', 'signup-object@nodii.test', '{"signup_locale":{"name":"en"}}'),
  ('aaaaaaaa-0000-4000-8000-000000000016', 'signup-legacy@nodii.test', null),
  ('aaaaaaaa-0000-4000-8000-000000000017', 'signup-untrusted@nodii.test', '{"signup_locale":"en","default_goal_name":"Injected","role":"service_role"}');

select is((select count(*) from public.profiles where id::text like 'aaaaaaaa-0000-4000-8000-00000000001%'),
          7::bigint, '모든 가입 경로에서 프로필을 만든다');
select results_eq(
  $$select user_id, name from public.goals where user_id::text like 'aaaaaaaa-0000-4000-8000-00000000001%' order by user_id$$,
  $$values
    ('aaaaaaaa-0000-4000-8000-000000000011'::uuid, 'Todos'::text),
    ('aaaaaaaa-0000-4000-8000-000000000012'::uuid, '할 일'::text),
    ('aaaaaaaa-0000-4000-8000-000000000013'::uuid, '할 일'::text),
    ('aaaaaaaa-0000-4000-8000-000000000014'::uuid, '할 일'::text),
    ('aaaaaaaa-0000-4000-8000-000000000015'::uuid, '할 일'::text),
    ('aaaaaaaa-0000-4000-8000-000000000016'::uuid, '할 일'::text),
    ('aaaaaaaa-0000-4000-8000-000000000017'::uuid, 'Todos'::text)$$,
  '언어 힌트만 허용하고 임의 이름·권한 메타데이터는 초기 이름에 영향을 주지 않는다');
select is((select count(*) from public.goals where user_id::text like 'aaaaaaaa-0000-4000-8000-00000000001%'
           and color = '#4F7CFF' and sort_key = 'a0' and archived_at is null and deleted_at is null),
          7::bigint, '계정당 기본 활성 목표 하나와 기존 색·정렬 키를 유지한다');

update auth.users set raw_user_meta_data = '{"signup_locale":"ko"}'
where id = 'aaaaaaaa-0000-4000-8000-000000000011';
select is((select name from public.goals where user_id = 'aaaaaaaa-0000-4000-8000-000000000011'),
          'Todos', '가입 후 언어 힌트 변경은 기존 기본 목표를 바꾸지 않는다');
update public.goals set name = '내 목표' where user_id = 'aaaaaaaa-0000-4000-8000-000000000012';
update auth.users set raw_user_meta_data = '{"signup_locale":"en"}'
where id = 'aaaaaaaa-0000-4000-8000-000000000012';
select is((select name from public.goals where user_id = 'aaaaaaaa-0000-4000-8000-000000000012'),
          '내 목표', '사용자가 수정한 이름도 언어 힌트 변경으로 덮어쓰지 않는다');
select is((select count(*) from public.goals where user_id = 'aaaaaaaa-0000-4000-8000-000000000011'),
          1::bigint, '메타데이터 변경으로 목표가 중복 생성되지 않는다');

select ok(not has_function_privilege('anon', 'public.handle_new_user()', 'execute'),
          'anon은 가입 트리거 함수를 직접 실행할 수 없다');
select ok(not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
          'authenticated도 가입 트리거 함수를 직접 실행할 수 없다');
select ok((select prosecdef from pg_proc where oid = 'public.handle_new_user()'::regprocedure),
          '가입 트리거에 필요한 definer 실행만 유지한다');
select is((select proconfig from pg_proc where oid = 'public.handle_new_user()'::regprocedure),
          array['search_path=""'], '빈 search_path를 유지한다');

set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000011"}';
select results_eq($$select name from public.goals$$, $$values ('Todos'::text)$$,
                  '영어 기본 목표도 RLS를 통해 본인만 조회한다');
select is_empty($$select id from public.goals where user_id = 'aaaaaaaa-0000-4000-8000-000000000012'$$,
                '다른 계정의 목표 조회는 계속 거부한다');
select is_empty($$update public.goals set name = 'Overwrite' where user_id = 'aaaaaaaa-0000-4000-8000-000000000012' returning id$$,
                '다른 계정의 목표 이름 변경도 계속 거부한다');
select throws_ok($$select public.handle_new_user()$$, '42501', null,
                 '인증된 클라이언트의 가입 트리거 직접 호출을 거부한다');

select * from finish();
rollback;
