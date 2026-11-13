-- SOC-61: 차단 관계로 숨긴 프로필의 이름과 사진만 차단한 본인에게 돌려준다.
create function public.my_blocked_profiles()
returns table (user_id uuid, handle text, nickname text, avatar_path text, blocked_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.handle, p.nickname,
    case when p.auto_hidden_at is null then p.avatar_path end,
    b.created_at
  from public.blocks b
  join public.social_profiles p on p.user_id = b.blocked_id
  where b.blocker_id = (select auth.uid())
  order by b.created_at desc, p.user_id;
$$;

revoke all on function public.my_blocked_profiles() from public, anon, authenticated;
grant execute on function public.my_blocked_profiles() to authenticated;
