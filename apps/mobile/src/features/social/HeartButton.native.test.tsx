import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fetchMyReactions, react, unreact, useMyReactions, type NodiiClient } from '@nodii/api';
import { ToastProvider } from '../../components/Toast';
import { HeartButton } from './HeartButton';

jest.mock('../../../../../packages/api/src/repositories/notifications', () => ({
  fetchMyReactions: jest.fn(),
  react: jest.fn(),
  unreact: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));

const client = {} as NodiiClient;
const target = { todoId: 'completed' };
function Button() {
  const query = useMyReactions(client, 'me', { todoIds: ['completed'], routineDates: [] });
  return (
    <HeartButton
      client={client}
      me="me"
      target={target}
      title="독서"
      color="#4F7CFF"
      ready={query.isSuccess}
      reactionId={query.data?.['todo:completed']}
    />
  );
}

it('shows the optimistic heart, rolls back with an error, and removes a saved like', async () => {
  let reject: (error: unknown) => void = () => {};
  jest.mocked(fetchMyReactions).mockResolvedValue({});
  jest
    .mocked(react)
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, fail) => {
          reject = fail;
        }),
    )
    .mockResolvedValueOnce('like-id');
  jest.mocked(unreact).mockResolvedValue(undefined);
  const query = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { gcTime: 0 } },
  });
  render(
    <QueryClientProvider client={query}>
      <ToastProvider>
        <Button />
      </ToastProvider>
    </QueryClientProvider>,
  );
  const like = () => screen.getByRole('togglebutton', { name: '독서 좋아요' });
  await waitFor(() => expect(like()).toBeEnabled());
  fireEvent.press(like());
  expect(
    (await screen.findByRole('togglebutton', { name: '좋아요 취소' })).props.accessibilityState
      .checked,
  ).toBe(true);
  await act(async () => reject(new Error('not_done')));
  expect(await screen.findByText('반응을 남기지 못했어요')).toBeTruthy();
  await waitFor(() => expect(like()).toBeEnabled());
  expect(like().props.accessibilityState.checked).toBe(false);
  fireEvent.press(like());
  await waitFor(() =>
    expect(screen.getByRole('togglebutton', { name: '좋아요 취소' })).toBeEnabled(),
  );
  fireEvent.press(screen.getByRole('togglebutton', { name: '좋아요 취소' }));
  await waitFor(() => expect(unreact).toHaveBeenCalledWith(client, 'me', 'like-id'));
  expect(like().props.accessibilityState.checked).toBe(false);
});
