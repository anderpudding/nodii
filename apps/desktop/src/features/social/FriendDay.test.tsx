import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { monthGridRange, monthKeyOf } from '@nodii/core';
import { mapGoal, mapTodo } from '@nodii/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { expect, it, vi } from 'vitest';
import { useState } from 'react';
import { FriendDay } from './FriendDay';
import { GoalMark } from '../goals/GoalMark';
import { baseUrl, createTestClient } from '../../test/auth-fixtures';
import { goalRow, todoRow } from '../../test/data-fixtures';
import { server } from '../../test/server';

it('renders the three v3 goal marks and always uses a dot for a friend', () => {
  const { container } = render(
    <>
      <GoalMark color="#4F7CFF" visibility="private" />
      <GoalMark color="#4F7CFF" visibility="mutual" />
      <GoalMark color="#4F7CFF" visibility="followers" />
      <GoalMark color="#4F7CFF" visibility="followers" friend />
    </>,
  );
  expect(
    [...container.querySelectorAll('[data-goal-mark]')].map((el) =>
      el.getAttribute('data-goal-mark'),
    ),
  ).toEqual(['dot', 'mutual', 'followers', 'dot']);
});

it('toggles a completed friend’s heart and restores it after a rejected request', async () => {
  const date = '2026-11-13';
  const client = createTestClient();
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const rest = `${baseUrl}/rest/v1`;
  const request = vi
    .fn()
    .mockReturnValueOnce(HttpResponse.json({ code: 'P0001', message: 'not_done' }, { status: 400 }))
    .mockReturnValueOnce(HttpResponse.json('like-id'));
  const remove = vi.fn(() => new HttpResponse(null, { status: 204 }));
  // 달력과 친구 하루 조회는 아래 테스트에서 다룬다. 여기서는 준비된 목록의 반응만 검증한다.
  cache.setQueryData(['myReactions', 'me', [`todo:${todoRow.id}`]], {});
  const range = monthGridRange(monthKeyOf(date), 0);
  cache.setQueryData(['friend', 'friend', range.from, range.to], {
    goals: [mapGoal({ ...goalRow, user_id: 'friend', visibility: 'followers' })],
    todos: [
      mapTodo({ ...todoRow, date, user_id: 'friend', is_done: true }),
      mapTodo({
        ...todoRow,
        id: 'pending',
        title: 'Pending',
        date,
        user_id: 'friend',
        is_done: false,
      }),
    ],
    routines: [],
    logs: [],
  });
  server.use(
    http.get(`${rest}/goals`, () => HttpResponse.json([{ ...goalRow, user_id: 'friend' }])),
    http.get(`${rest}/todos`, () =>
      HttpResponse.json([
        { ...todoRow, date, user_id: 'friend', is_done: true },
        { ...todoRow, id: 'pending', title: 'Pending', date, user_id: 'friend', is_done: false },
      ]),
    ),
    http.get(`${rest}/routines`, () => HttpResponse.json([])),
    http.get(`${rest}/routine_logs`, () => HttpResponse.json([])),
    http.get(`${rest}/reactions`, () => HttpResponse.json([])),
    http.post(`${rest}/rpc/react`, request),
    http.delete(`${rest}/reactions`, remove),
  );
  const view = render(
    <QueryClientProvider client={cache}>
      <FriendDay
        friendId="friend"
        client={client}
        me="me"
        date={date}
        today={date}
        profile={{ timezone: 'UTC', weekStart: 0 }}
        onSelect={() => {}}
      />
    </QueryClientProvider>,
  );
  try {
    const list = within(screen.getByRole('region', { name: '목표별 할 일 목록' }));
    const like = list.getByRole('button', { name: `${todoRow.title} 좋아요` });
    await waitFor(() => expect(like.getAttribute('aria-disabled')).toBe('false'));
    expect(list.queryByRole('button', { name: 'Pending 좋아요' })).toBeNull();
    const user = userEvent.setup();
    await user.click(like);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(like.getAttribute('aria-pressed')).toBe('false'));
    await user.click(like);
    await waitFor(() => expect(like.getAttribute('aria-disabled')).toBe('false'));
    await user.click(list.getByRole('button', { name: '좋아요 취소' }));
    await waitFor(() => expect(remove).toHaveBeenCalledTimes(1));
    expect(like.getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('menu')).toBeNull();
  } finally {
    view.unmount();
    cache.clear();
    await client.auth.dispose();
  }
});

it('keeps the chosen day, shows only a report action, and moves to today from the month title', async () => {
  const friend = 'friend';
  const date = '2026-09-30';
  const today = '2026-11-13';
  const rest = `${baseUrl}/rest/v1`;
  server.use(
    http.get(`${rest}/goals`, () =>
      HttpResponse.json([{ ...goalRow, user_id: friend, visibility: 'followers' }]),
    ),
    http.get(`${rest}/todos`, () => HttpResponse.json([{ ...todoRow, date, user_id: friend }])),
    http.get(`${rest}/routines`, () => HttpResponse.json([])),
    http.get(`${rest}/routine_logs`, () => HttpResponse.json([])),
  );
  const client = createTestClient();
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const selected = vi.fn();
  function Page() {
    const [day, setDay] = useState(date);
    return (
      <FriendDay
        friendId={friend}
        client={client}
        me="me"
        profile={{ timezone: 'UTC', weekStart: 0 }}
        date={day}
        today={today}
        onSelect={(value) => {
          selected(value);
          setDay(value);
        }}
      />
    );
  }
  const view = render(
    <QueryClientProvider client={cache}>
      <Page />
    </QueryClientProvider>,
  );
  try {
    const list = await screen.findByRole('region', { name: '목표별 할 일 목록' });
    expect(await within(list).findByText(todoRow.title)).toBeTruthy();
    expect(within(list).queryByRole('button', { name: /완료|추가/ })).toBeNull();
    expect(list.querySelector('[data-goal-mark="dot"]')).toBeTruthy();
    const user = userEvent.setup();
    await user.click(within(list).getByRole('button', { name: /메뉴/ }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['신고하기']);
    await user.click(screen.getByRole('menuitem', { name: '신고하기' }));
    expect(await screen.findByRole('heading', { name: '할 일 신고' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '취소' }));
    const monthTitle = view.container.querySelector<HTMLElement>('.sidebar .calendar-month-title');
    expect(monthTitle?.getAttribute('aria-label')).toContain('2026년 9월');
    await user.click(monthTitle!);
    expect(selected).toHaveBeenCalledWith(today);
  } finally {
    view.unmount();
    cache.clear();
    await client.auth.dispose();
  }
});
