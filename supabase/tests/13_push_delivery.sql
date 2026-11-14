begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(17);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'),
  ('10000000-0000-4000-8000-000000000002', 'b@nodii.test');
insert into public.push_tokens (token, user_id, platform)
values ('ExponentPushToken[other]', '10000000-0000-4000-8000-000000000001', 'ios');
select results_eq($$select locale, time_zone, app_version from public.push_tokens where token = 'ExponentPushToken[other]'$$,
  $$values ('ko'::text, 'UTC'::text, null::text)$$, '기기 설정 기본값');

set local role anon;
select throws_ok($$select public.register_push_token('ExponentPushToken[test]', 'ko', 'UTC', null)$$,
  '42501', null, 'anon 등록 거부');
set local role authenticated;
select throws_ok($$select public.register_push_token('ExponentPushToken[test]', 'ko', 'UTC', null)$$,
  '42501', 'authentication_required', '로그인하지 않은 세션은 등록 거부');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select lives_ok($$select public.register_push_token('ExponentPushToken[test]', 'ko', 'Asia/Seoul', '0.3.0')$$, 'A 등록');
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select lives_ok($$select public.register_push_token('ExponentPushToken[test]', 'en', 'America/Vancouver', '0.3.1')$$, 'B가 같은 토큰 등록');
select results_eq($$select user_id, locale, time_zone, app_version from public.push_tokens$$,
  $$values ('10000000-0000-4000-8000-000000000002'::uuid, 'en'::text, 'America/Vancouver'::text, '0.3.1'::text)$$, '토큰 소유권과 기기 설정 이전');
select is_empty($$update public.push_tokens set locale = 'en' where token = 'ExponentPushToken[other]' returning token$$, '다른 토큰 직접 수정 거부');
select is_empty($$delete from public.push_tokens where token = 'ExponentPushToken[other]' returning token$$, '다른 토큰 직접 삭제 거부');
select throws_ok($$select public.register_push_token('ExponentPushToken[test]', 'en', 'Invalid/Zone', null)$$,
  '22023', 'invalid_push_token', '없는 시간대 거부');
select throws_ok($$select public.register_push_token('ExponentPushToken[test]', 'fr', 'UTC', null)$$,
  '22023', 'invalid_push_token', '지원하지 않는 언어 거부');
select throws_ok($$select public.register_push_token('invalid', 'en', 'UTC', null)$$,
  '22023', 'invalid_push_token', '틀린 토큰 형식 거부');
select throws_ok($$select * from public.push_throttle$$, '42501', null, '클라이언트는 발송 제한을 읽을 수 없음');
reset role;

set local role service_role;
select lives_ok($$insert into public.push_throttle values (
  '10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', now())$$, '서비스 역할만 발송 제한 기록');
select is_empty($$select token from public.push_tokens
  where user_id = '10000000-0000-4000-8000-000000000001' and token = 'ExponentPushToken[test]'$$, 'A 발송 대상에서 이전 토큰 제외');
reset role;

-- pg_net worker는 커밋된 요청만 가져간다. 여기서는 큐를 확인한 뒤 롤백한다.
delete from vault.secrets where name in ('project_url', 'push_webhook_secret');
insert into public.notifications (id, recipient_id, actor_id, kind, date, count)
values ('10000000-0000-4000-8000-000000000099', '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', 'friend_done', '2026-11-14', 1);
select is_empty($$select id from net.http_request_queue where body = convert_to(
  '{"notification_id":"10000000-0000-4000-8000-000000000099"}'::jsonb::text, 'UTF8')$$, 'Vault 설정이 없으면 큐에 넣지 않음');

select vault.create_secret('https://s6-example.invalid/', 'project_url');
select vault.create_secret(gen_random_uuid()::text, 'push_webhook_secret');
insert into public.notifications (id, recipient_id, actor_id, kind)
values ('10000000-0000-4000-8000-000000000098', '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002', 'follow');
select results_eq($$select convert_from(body, 'UTF8')::jsonb from net.http_request_queue
  where url = 'https://s6-example.invalid/functions/v1/send-push' and method = 'POST'$$,
  $$values ('{"notification_id":"10000000-0000-4000-8000-000000000098"}'::jsonb)$$, 'INSERT 요청 본문에 알림 ID만 있음');
update public.notifications set count = 2, updated_at = updated_at + interval '1 second'
  where id = '10000000-0000-4000-8000-000000000099';
update public.notifications set count = 2, updated_at = updated_at + interval '1 second'
  where id = '10000000-0000-4000-8000-000000000099';
update public.notifications set count = 1, updated_at = updated_at + interval '1 second'
  where id = '10000000-0000-4000-8000-000000000099';
update public.notifications set updated_at = updated_at + interval '1 second'
  where id = '10000000-0000-4000-8000-000000000098';
select results_eq($$select convert_from(body, 'UTF8')::jsonb from net.http_request_queue
  where url = 'https://s6-example.invalid/functions/v1/send-push' order by id$$,
  $$values ('{"notification_id":"10000000-0000-4000-8000-000000000098"}'::jsonb),
    ('{"notification_id":"10000000-0000-4000-8000-000000000099"}'::jsonb)$$, '친구 완료 숫자 증가 UPDATE만 추가 발송');

select * from finish();
rollback;
