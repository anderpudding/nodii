-- AUTH-04 / SET-06: 첫 가입 때의 표시 언어로만 기본 목표 이름을 정한다.
-- signup_locale은 권한이나 기기별 언어 설정에 쓰지 않는 초기 데이터 힌트다.
-- 미전달·잘못된 값은 기존 클라이언트와 동일하게 한국어로 처리한다.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id);
  insert into public.goals (user_id, name, color, sort_key)
  values (
    new.id,
    case when new.raw_user_meta_data ->> 'signup_locale' = 'en' then 'Todos' else '할 일' end,
    '#4F7CFF',
    'a0'
  );
  return new;
end;
$$;

-- 인증 서버의 INSERT 트리거 전용이다. 클라이언트에서 직접 실행할 수 없다.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
