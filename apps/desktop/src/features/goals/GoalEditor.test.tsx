import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { expect, it, vi } from 'vitest';
import { mapGoal } from '@nodii/api';
import { VisibilityContext } from '../social/VisibilityContext';
import { GoalEditor } from './GoalEditor';
import { baseUrl, createTestClient } from '../../test/auth-fixtures';
import { goalRow } from '../../test/data-fixtures';
import { server } from '../../test/server';

it('previews HEX input and only publishes when the editor is saved', async () => {
  const client = createTestClient();
  const cache = new QueryClient();
  cache.setQueryData(['goals'], [mapGoal(goalRow)]);
  const onBack = vi.fn();
  const writes = vi.fn(async ({ request }: { request: Request }) => {
    const patch = await request.json();
    return HttpResponse.json({ ...goalRow, ...patch });
  });
  server.use(http.patch(`${baseUrl}/rest/v1/goals`, writes));
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  const view = render(
    <QueryClientProvider client={cache}>
      <VisibilityContext.Provider value>
        <GoalEditor
          client={client}
          userId={goalRow.user_id}
          goal={mapGoal(goalRow)}
          initialColor={goalRow.color}
          sortKey={goalRow.sort_key}
          onBack={onBack}
          onDelete={() => {}}
        />
      </VisibilityContext.Provider>
    </QueryClientProvider>,
  );
  try {
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '직접 고르기' }));
    const hex = screen.getByRole('textbox', { name: 'HEX 색상' });
    await user.clear(hex);
    await user.type(hex, '2af');
    expect(screen.getByRole('img', { name: '고른 색 #22AAFF' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: '팔로워' }));
    expect(writes).not.toHaveBeenCalled();
    expect(storage.mock.calls.filter(([key]) => key === 'nodii:first-publish-notice')).toHaveLength(
      1,
    );
    await user.click(screen.getByRole('button', { name: '나만' }));
    await user.click(screen.getByRole('button', { name: '맞팔로우' }));
    expect(storage.mock.calls.filter(([key]) => key === 'nodii:first-publish-notice')).toHaveLength(
      1,
    );
    await user.click(screen.getByRole('button', { name: '저장' }));
    await waitFor(() => expect(onBack).toHaveBeenCalledOnce());
    expect(writes).toHaveBeenCalledOnce();
    expect(cache.getQueryData(['goals'])).toEqual([
      expect.objectContaining({ id: goalRow.id, color: '#22AAFF', visibility: 'mutual' }),
    ]);
  } finally {
    storage.mockRestore();
    localStorage.removeItem('nodii:first-publish-notice');
    view.unmount();
    cache.clear();
    await client.auth.dispose();
  }
});
