import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { t, type LanguagePreference } from '@nodii/i18n';
import { Providers } from '../../app/providers';
import { useLocale } from '../../lib/language';
import { baseUrl, createTestClient } from '../../test/auth-fixtures';
import { server } from '../../test/server';
import { Login } from './Login';

const clients: ReturnType<typeof createTestClient>[] = [];
afterEach(async () => {
  for (const client of clients.splice(0)) await client.auth.dispose();
  vi.restoreAllMocks();
});

function setup(preference: LanguagePreference, systemLanguage: string) {
  localStorage.setItem('nodii-language', preference);
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue([systemLanguage]);
  const client = createTestClient();
  clients.push(client);
  function Content() {
    useLocale();
    return <Login client={client} />;
  }
  render(
    <Providers>
      <Content />
    </Providers>,
  );
  return userEvent.setup();
}

it.each([
  ['system', 'en-CA', 'en'],
  ['system', 'ko-KR', 'ko'],
  ['ko', 'en-US', 'ko'],
  ['en', 'ko-KR', 'en'],
] as const)(
  '%s 설정·OS %s이면 가입 언어 %s를 실제 OTP 요청에 보낸다',
  async (preference, system, locale) => {
    const sent = vi.fn();
    server.use(
      http.post(`${baseUrl}/auth/v1/otp`, async ({ request }) => {
        sent(await request.json());
        return HttpResponse.json({});
      }),
    );
    const user = setup(preference, system);
    await waitFor(() => expect(document.documentElement.lang).toBe(locale));
    await user.type(screen.getByLabelText(t('auth.email')), 'new@example.com');
    await user.click(screen.getByRole('button', { name: t('auth.send') }));
    await waitFor(() => expect(sent).toHaveBeenCalledOnce());
    expect(sent).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@example.com',
        create_user: true,
        data: { signup_locale: locale },
      }),
    );
  },
);

it('재전송도 요청 시점의 언어를 사용한다', async () => {
  const sent = vi.fn();
  server.use(
    http.post(`${baseUrl}/auth/v1/otp`, async ({ request }) => {
      sent(await request.json());
      return HttpResponse.json({});
    }),
  );
  const user = setup('system', 'en-US');
  await waitFor(() => expect(document.documentElement.lang).toBe('en'));
  await user.type(screen.getByLabelText('Email'), 'new@example.com');
  await user.click(screen.getByRole('button', { name: 'Get Code' }));
  await screen.findByLabelText('6-digit code');
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['ko-KR']);
  act(() => window.dispatchEvent(new Event('languagechange')));
  vi.useFakeTimers({ toFake: ['Date'] });
  act(() => vi.setSystemTime(Date.now() + 61000));
  const resend = await screen.findByRole('button', { name: '코드 다시 받기' }, { timeout: 2000 });
  fireEvent.click(resend);
  await waitFor(() => expect(sent).toHaveBeenCalledTimes(2));
  expect(sent).toHaveBeenNthCalledWith(
    1,
    expect.objectContaining({ data: { signup_locale: 'en' } }),
  );
  expect(sent).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ data: { signup_locale: 'ko' } }),
  );
});
