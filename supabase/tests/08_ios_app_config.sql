begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(7);
set local role anon;
select results_eq($q$select value from public.app_config where key = 'min_ios_app_version'$q$,
  $e$values ('0.1.0'::text)$e$, '비로그인 iOS 최소 버전 읽기');
select throws_ok($q$insert into public.app_config (key, value) values ('forbidden_ios', '99')$q$, '42501', null, 'anon INSERT 거부');
select throws_ok($q$update public.app_config set value = '99' where key = 'min_ios_app_version'$q$, '42501', null, 'anon iOS 버전 UPDATE 거부');
select throws_ok($q$delete from public.app_config where key = 'min_ios_app_version'$q$, '42501', null, 'anon iOS 버전 DELETE 거부');
set local role authenticated;
select results_eq($q$select value from public.app_config where key = 'min_ios_app_version'$q$,
  $e$values ('0.1.0'::text)$e$, '로그인한 사용자 iOS 최소 버전 읽기');
select throws_ok($q$update public.app_config set value = '99' where key = 'min_ios_app_version'$q$, '42501', null, 'authenticated iOS 버전 UPDATE 거부');
select throws_ok($q$delete from public.app_config where key = 'min_ios_app_version'$q$, '42501', null, 'authenticated iOS 버전 DELETE 거부');
select * from finish();
rollback;
