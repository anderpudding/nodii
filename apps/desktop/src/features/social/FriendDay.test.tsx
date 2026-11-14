import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
