import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { NodiiClient } from '@nodii/api';
import { Login } from './Login';
import { server } from '../../test/server';
import { baseUrl, createTestClient, sessionResponse } from '../../test/auth-fixtures';

const clients: NodiiClient[] = [];
function setup(reviewAccountEmail = '') {
  const client = createTestClient();
  clients.push(client);
  render(<Login client={client} reviewAccountEmail={reviewAccountEmail} />);
  return { client, user: userEvent.setup() };
}
afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.auth.dispose()));
});
async function receiveCode(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('이메일'), 'user@example.com');
  await user.click(screen.getByRole('button', { name: '코드 받기' }));
  await screen.findByLabelText('6자리 인증 코드');
}

describe('이메일 OTP 로그인 (AUTH-01/07)', () => {
  it('이메일 → 코드, 붙여넣기 자동 검증과 세션 저장, 중복 요청 방지', async () => {
    const otp = vi.fn();
    const verify = vi.fn();
    server.use(
      http.post(`${baseUrl}/auth/v1/otp`, async ({ request }) => {
        otp(await request.json());
        return HttpResponse.json({});
      }),
      http.post(`${baseUrl}/auth/v1/verify`, async ({ request }) => {
        verify(await request.json());
        return HttpResponse.json(sessionResponse);
      }),
    );
    const { user, client } = setup();
    await receiveCode(user);
    expect(otp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', create_user: true }),
    );
    expect(
      (screen.getByRole('button', { name: /코드 다시 받기/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole('button', { name: '로그인' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.click(screen.getByLabelText('6자리 인증 코드'));
    await user.paste('123456');
    await waitFor(() => expect(verify).toHaveBeenCalledOnce());
    expect(verify).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com', token: '123456', type: 'email' }),
    );
    await waitFor(async () =>
      expect((await client.auth.getSession()).data.session?.user.id).toBe(sessionResponse.user.id),
    );
  });
  it('60초가 지난 뒤 재전송을 허용하고 다시 카운트다운한다', async () => {
    const sent = vi.fn();
    server.use(
      http.post(`${baseUrl}/auth/v1/otp`, () => {
        sent();
        return HttpResponse.json({});
      }),
    );
    const { user } = setup();
    await receiveCode(user);
    vi.useFakeTimers({ toFake: ['Date'] });
    await act(async () => {
      vi.setSystemTime(Date.now() + 61000);
    });
    // 실제 interval은 fake timers 전 생성됐으므로 Date를 앞으로 옮긴 뒤 다음 tick을 기다린다.
    await waitFor(
      () =>
        expect(
          (screen.getByRole('button', { name: /코드 다시 받기/ }) as HTMLButtonElement).disabled,
        ).toBe(false),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole('button', { name: '코드 다시 받기' }));
    await waitFor(() => expect(sent).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /코드 다시 받기/ }) as HTMLButtonElement).disabled,
      ).toBe(true),
    );
  });
  it.each([
    ['invalid_code', '코드가 맞지 않아요. 메일의 숫자를 다시 확인해 주세요.'],
    ['otp_expired', '코드 유효 시간(10분)이 지났어요. 새 코드를 받아 주세요.'],
    ['over_request_rate_limit', '요청이 너무 잦아요. 잠시 후 다시 시도해 주세요.'],
  ])('%s 오류를 알리고 코드를 다시 입력할 수 있다', async (code, message) => {
    server.use(
      http.post(`${baseUrl}/auth/v1/otp`, () => HttpResponse.json({})),
      http.post(`${baseUrl}/auth/v1/verify`, () =>
        HttpResponse.json(
          { code, msg: code },
          { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } },
        ),
      ),
    );
    const { user } = setup();
    await receiveCode(user);
    await user.click(screen.getByLabelText('6자리 인증 코드'));
    await user.paste('000000');
    expect((await screen.findByRole('alert')).textContent).toBe(message);
    expect((screen.getByLabelText('6자리 인증 코드') as HTMLInputElement).value).toBe('');
  });
  it('형식이 잘못된 이메일은 전송하지 않고 안내한다', async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText('이메일'), 'invalid');
    await user.click(screen.getByRole('button', { name: '코드 받기' }));
    expect(screen.getByRole('alert').textContent).toContain('이메일 주소');
  });
  it('네트워크 실패를 알리고 이메일 단계에 남는다', async () => {
    server.use(http.post(`${baseUrl}/auth/v1/otp`, () => HttpResponse.error()));
    const { user } = setup();
    await user.type(screen.getByLabelText('이메일'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: '코드 받기' }));
    expect((await screen.findByRole('alert')).textContent).toContain('인터넷 연결');
    expect(screen.queryByLabelText('6자리 인증 코드')).toBeNull();
  });
});

describe('심사 계정 분기 (AUTH-08)', () => {
  it('trim·대소문자 무시한 정확한 이메일만 비밀번호 로그인을 사용한다', async () => {
    const passwordLogin = vi.fn();
    server.use(
      http.post(`${baseUrl}/auth/v1/token`, async ({ request }) => {
        passwordLogin(await request.json());
        return HttpResponse.json(sessionResponse);
      }),
    );
    const { user } = setup(' Review@Example.com ');
    const input = screen.getByLabelText('이메일');
    await user.type(input, 'review@example.com.attacker');
    expect(screen.queryByLabelText('비밀번호')).toBeNull();
    await user.clear(input);
    await user.type(input, ' REVIEW@example.com ');
    await user.type(screen.getByLabelText('비밀번호'), 'review-test-password');
    await user.click(screen.getByRole('button', { name: '로그인' }));
    await waitFor(() =>
      expect(passwordLogin).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'review@example.com', password: 'review-test-password' }),
      ),
    );
  });
  it('환경 변수가 비어 있으면 비밀번호 입력란이 없다', async () => {
    const { user } = setup();
    expect(screen.queryByLabelText('비밀번호')).toBeNull();
    await user.type(screen.getByLabelText('이메일'), 'appreview@nodii.app');
    expect(screen.queryByLabelText('비밀번호')).toBeNull();
  });
});
