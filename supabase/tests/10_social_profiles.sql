begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(51);

insert into auth.users (id, email) values
  ('10000000-0000-4000-8000-000000000001', 'a@nodii.test'), ('10000000-0000-4000-8000-000000000002', 'b@nodii.test'),
  ('10000000-0000-4000-8000-000000000003', 'c@nodii.test'), ('10000000-0000-4000-8000-000000000004', 'd@nodii.test');
select is((select value from public.app_config where key = 'social_enabled'), 'false', '기능 플래그 기본값은 꺼짐');
select is((select count(*) from public.social_profiles), 0::bigint, '가입만으로 소셜 프로필을 만들지 않음');
select is((select count(*) from public.goals where visibility <> 'private'), 0::bigint, '기본 목표는 private');

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select is((select count(*) from public.banned_words), 2373::bigint, '금칙어 CSV 전체를 읽을 수 있음');
select is((select count(*) from public.reserved_words), 33::bigint, '예약어 CSV 전체를 읽을 수 있음');
select throws_ok($$insert into public.banned_words values ('example', 'exact', 'en')$$, '42501', null, '금칙어 수정 권한 없음');
select throws_ok($$delete from public.reserved_words$$, '42501', null, '예약어 수정 권한 없음');

select is_empty($$select sample from unnest(array[
  '2026년', '청년', 'class', 'title', 'hello', '생리학', '새끼손가락', '시바견',
  '아버지', '보지마', '시발점', '발기인', '젓가락', '하루 세끼'
]) as sample where not public.text_is_allowed(sample)$$, 'SOC-64 통과 예시 전체');
select is_empty($$select sample from unnest(array['씨발', '개새끼', 'shithead', 'xx좆xx', '（년）', 'ＡＳＳ']) as sample
  where public.text_is_allowed(sample)$$, 'SOC-64 금칙어 예시 및 NFKC·한글 토큰 검사');
select is_empty($$select sample from unnest(array['nodii', 'Admin', '운영자']) as sample
  where not public.text_is_reserved(sample)$$, 'SOC-64 예약어 예시 전체');
select ok(not public.text_is_reserved('Admin team'), '예약어는 전체 일치만 적용');
select is(public.normalize_text('Ｎｏｄｉｉ'), 'nodii', 'NFKC와 소문자 적용');

select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000001', 'Abc', 'Reader')$$,
  '23514', null, 'DB가 대문자 핸들 거부');
select is_empty($$select sample from unnest(array['ab', '1abc', 'abc..def', 'abc.', 'a-b', 'abcdefghijklmnopqrstu']) as sample
  where public.handle_available(sample) <> 'invalid'$$, '길이·시작 문자·구두점 형식 검사');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000001', 'abc..def', 'Reader')$$,
  '23514', null, '프로필에도 핸들 형식 적용');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000001', 'nodii', 'Reader')$$,
  'P0001', 'reserved', '예약 핸들 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000001', 'reader', 'Admin')$$,
  'P0001', 'reserved', '예약 닉네임 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000001', 'shithead', 'Reader')$$,
  'P0001', 'banned', '금칙 핸들 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000001', 'reader', '씨발')$$,
  'P0001', 'banned', '금칙 닉네임 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname, bio) values ('10000000-0000-4000-8000-000000000001', 'reader', 'Reader', '개새끼')$$,
  'P0001', 'banned', '금칙 소개 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname, bio) values ('10000000-0000-4000-8000-000000000001', 'reader', 'Reader', repeat('x', 81))$$,
  '23514', null, '소개 81자 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname, bio) values ('10000000-0000-4000-8000-000000000001', 'reader', 'Reader', E'a\nb\nc')$$,
  '23514', null, '소개 3줄 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000001', 'reader', repeat('x', 21))$$,
  '23514', null, '닉네임 21자 거부');
select throws_ok($$insert into public.social_profiles (user_id, handle, nickname) values ('10000000-0000-4000-8000-000000000002', 'nodii', 'Reader')$$,
  '42501', null, '남의 프로필 생성은 핸들 검사 전에 거부');
select lives_ok($$insert into public.social_profiles (user_id, handle, nickname, bio) values ('10000000-0000-4000-8000-000000000001', 'reader', 'Reader', E'a\r\nb')$$,
  '본인 프로필 생성과 두 줄 소개 허용');
select throws_ok($$update public.social_profiles set auto_hidden_at = null where user_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', null, '본인도 자동 숨김 시각 수정 불가');
select throws_ok($$update public.social_profiles set social_suspended_at = null where user_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', null, '본인도 정지 시각 수정 불가');
select throws_ok($$update public.social_profiles set handle_changed_at = null where user_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501', null, '본인도 핸들 변경 시각 수정 불가');

select ok((select token ~ '^[0-9a-f]{24}$' from public.invite_links where user_id = '10000000-0000-4000-8000-000000000001'), '초대 토큰 자동 생성');
select is(public.resolve_invite((select token from public.invite_links)), '10000000-0000-4000-8000-000000000001'::uuid, '유효한 초대 링크를 해석');
select is(public.resolve_invite('bogus'), null::uuid, '없는 초대 토큰 거부');
select lives_ok($$update public.social_profiles set handle = 'reader_new' where user_id = '10000000-0000-4000-8000-000000000001'$$, '첫 핸들 변경 허용');
select throws_ok($$update public.social_profiles set handle = 'reader' where user_id = '10000000-0000-4000-8000-000000000001'$$,
  'P0001', 'handle_cooldown', '변경 직후 30일 쿨다운');
select throws_ok($$select * from public.handle_holds$$, '42501', null, '보류 목록 직접 읽기 거부');
select is(public.handle_available('reader'), 'ok', '본인에게는 보류 핸들 사용 가능으로 안내');
select is(public.handle_available('nodii'), 'reserved', '예약어 안내');
select is(public.handle_available('shithead'), 'banned', '금칙어 안내');

reset role;
select ok((select available_at = now() + interval '30 days' and released_by = '10000000-0000-4000-8000-000000000001'
  from public.handle_holds where handle = 'reader'), '운영자에게 30일 보류 기록 확인');
insert into public.social_profiles (user_id, handle, nickname, searchable) values
  ('10000000-0000-4000-8000-000000000002', 'read', 'Exact', true), ('10000000-0000-4000-8000-000000000003', 'read_private', 'Private', false),
  ('10000000-0000-4000-8000-000000000004', 'novel', 'Reading', true);
select set_config('test.invite_c', (select token from public.invite_links where user_id = '10000000-0000-4000-8000-000000000003'), true);

set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select is(public.handle_available('reader'), 'held', '남에게는 묶인 핸들');
select is(public.handle_available('reader_new'), 'taken', '사용 중인 핸들');
select throws_ok($$update public.social_profiles set handle = 'reader' where user_id = '10000000-0000-4000-8000-000000000002'$$,
  'P0001', 'handle_held', '남의 보류 핸들 변경 거부');
select is_empty($$update public.social_profiles set nickname = 'Changed' where user_id = '10000000-0000-4000-8000-000000000001' returning 1$$,
  '다른 사람의 프로필 수정 거부');
select is_empty($$select token from public.invite_links where user_id = '10000000-0000-4000-8000-000000000001'$$, '남의 초대 토큰 조회 거부');
select is(public.resolve_invite(current_setting('test.invite_c')), '10000000-0000-4000-8000-000000000003'::uuid, '검색 비허용이어도 링크는 해석');

set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
select results_eq($$select handle from public.search_profiles('READ')$$,
  $$values ('read'::text), ('reader_new'), ('novel')$$, '정확한 핸들 → 핸들 접두사 → 닉네임, 검색 비허용 제외');
select is_empty($$select 1 from public.search_profiles('r')$$, '한 글자 검색 거부');
insert into public.blocks (blocker_id, blocked_id) values ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002'), ('10000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003');
select is_empty($$select 1 from public.search_profiles('read') where user_id = '10000000-0000-4000-8000-000000000002'$$, '차단된 사용자는 검색 제외');
select is(public.resolve_invite(current_setting('test.invite_c')), null::uuid, '차단 관계 초대 링크 거부');
select is_empty($$select user_id from public.social_profiles where user_id = '10000000-0000-4000-8000-000000000002'$$, '차단 관계 프로필 숨김');

reset role;
update public.social_profiles set handle_changed_at = now() - interval '30 days' where user_id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select lives_ok($$update public.social_profiles set handle = 'reader' where user_id = '10000000-0000-4000-8000-000000000001'$$,
  '쿨다운이 끝난 본인은 보류 중인 이전 핸들을 재사용');
reset role;
update public.handle_holds set available_at = now() where handle = 'reader_new';
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
select lives_ok($$update public.social_profiles set handle = 'reader_new' where user_id = '10000000-0000-4000-8000-000000000002'$$,
  '보류 기간이 지난 핸들은 다른 사용자도 사용');

select * from finish();
rollback;
