-- SOC-70: 삭제 경로와 무관하게 현재 핸들을 30일간 묶고 나머지는 FK로 정리한다.
create function social_private.hold_deleted_user_handle()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_handle text;
begin
  select handle into v_handle
  from public.social_profiles
  where user_id = old.id
  for update;

  if found then
    insert into public.handle_holds (handle, released_by, available_at)
    values (v_handle, null, now() + interval '30 days')
    on conflict (handle) do update
      set released_by = excluded.released_by, available_at = excluded.available_at;
  end if;

  return old;
end;
$$;
revoke execute on function social_private.hold_deleted_user_handle() from public, anon, authenticated;

create trigger hold_deleted_user_handle before delete on auth.users
  for each row execute function social_private.hold_deleted_user_handle();

-- delete_my_account()의 auth.users 삭제가 위 트리거를 실행한다.
-- 실제 사진 파일은 계정 삭제 전에 Storage API로 지워야 한다(S2).
-- follows의 DELETE 이벤트에는 RLS가 적용되지 않아 양쪽 사용자 ID가 드러난다(SOC-60).
alter publication supabase_realtime add table public.reactions, public.notifications;
