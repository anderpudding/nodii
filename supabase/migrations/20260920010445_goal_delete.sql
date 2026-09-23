-- GOAL-06: 하위 항목과 목표를 같은 트랜잭션에서 숨기고 RLS를 그대로 적용한다.
create or replace function public.delete_goal(p_goal_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform 1 from public.goals where id = p_goal_id and deleted_at is null for update;
  if not found then
    raise exception 'goal not found';
  end if;
  update public.todos set deleted_at = now() where goal_id = p_goal_id and deleted_at is null;
  update public.routines set deleted_at = now() where goal_id = p_goal_id and deleted_at is null;
  -- 마지막 활성 목표이면 트리거가 전체 변경을 롤백한다.
  update public.goals set deleted_at = now() where id = p_goal_id;
end;
$$;
revoke execute on function public.delete_goal(uuid) from public, anon;
grant execute on function public.delete_goal(uuid) to authenticated;
