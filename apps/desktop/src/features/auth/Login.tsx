import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  normalizeAuthError,
  sendOtp,
  verifyOtp,
  signInReviewAccount,
  type NodiiClient,
} from '@nodii/api';
import { OTP_RESEND_COOLDOWN_SECONDS } from '@nodii/core';
import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { InputOTP, InputOTPSlot } from '../../components/ui/input-otp';
import { authErrorMessage } from './errors';

/** AUTH-01/07/08: 메일 코드와 심사 계정을 하나의 로그인 진입점으로 제공한다. */
export function Login({
  client,
  reviewAccountEmail = '',
}: {
  client: NodiiClient;
  reviewAccountEmail?: string;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codeEmail, setCodeEmail] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [deadlines, setDeadlines] = useState<Record<string, number>>({});
  const [now, setNow] = useState(Date.now);
  const busy = useRef(false);
  const tokenInput = useRef<HTMLInputElement>(null);
  const normalizedEmail = email.trim().toLowerCase();
  const review =
    reviewAccountEmail.trim().length > 0 &&
    normalizedEmail === reviewAccountEmail.trim().toLowerCase();
  const destination = codeEmail ?? normalizedEmail;
  const remaining = Math.max(0, Math.ceil(((deadlines[destination] ?? 0) - now) / 1000));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  function startCooldown(address: string) {
    const timestamp = Date.now();
    setNow(timestamp);
    setDeadlines((previous) => ({
      ...previous,
      [address]: timestamp + OTP_RESEND_COOLDOWN_SECONDS * 1000,
    }));
  }

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('이메일 주소를 다시 확인해 주세요.');
      return;
    }
    if (!review && remaining > 0) {
      setCodeEmail(normalizedEmail);
      setError('');
      return;
    }
    busy.current = true;
    setPending(true);
    setError('');
    try {
      if (review) await signInReviewAccount(client, normalizedEmail, password);
      else {
        await sendOtp(client, normalizedEmail);
        startCooldown(normalizedEmail);
        setCodeEmail(normalizedEmail);
      }
    } catch (failure) {
      setError(authErrorMessage(failure, review));
      if (!review && normalizeAuthError(failure).code === 'rate_limited')
        startCooldown(normalizedEmail);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function submitCode(value: string) {
    if (busy.current || value.length !== 6 || !codeEmail) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await verifyOtp(client, codeEmail, value);
    } catch (failure) {
      setError(authErrorMessage(failure));
      setToken('');
      tokenInput.current?.focus();
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  async function resend() {
    if (busy.current || remaining > 0 || !codeEmail) return;
    busy.current = true;
    setPending(true);
    setError('');
    try {
      await sendOtp(client, codeEmail);
      startCooldown(codeEmail);
      setToken('');
    } catch (failure) {
      setError(authErrorMessage(failure));
      if (normalizeAuthError(failure).code === 'rate_limited') startCooldown(codeEmail);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <main className="center-screen">
      <section className="auth-panel" aria-labelledby="login-title">
        <header className="auth-heading">
          <p className="brand">Nodii</p>
          <h1 id="login-title">{codeEmail ? '메일을 확인해 주세요' : '같은 하루를, 어디서나'}</h1>
          <p className="supporting">
            {codeEmail ? (
              <>
                <span className="email-address">{codeEmail}</span>로 보낸
                <br />
                6자리 인증 코드를 입력해 주세요.
              </>
            ) : (
              '이메일로 간편하게 시작해 보세요.'
            )}
          </p>
        </header>
        {!codeEmail ? (
          <form
            noValidate
            onSubmit={(event) => void submitEmail(event)}
            className="auth-form"
            aria-busy={pending}
          >
            <div className="field-group">
              <label htmlFor="email">이메일</label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="name@example.com"
                value={email}
                disabled={pending}
                aria-invalid={!!error}
                aria-describedby={error ? 'auth-error' : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setPassword('');
                  setError('');
                }}
              />
            </div>
            {review && (
              <div className="field-group">
                <label htmlFor="password">비밀번호</label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  disabled={pending}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            )}
            {error && (
              <p id="auth-error" role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="auth"
              disabled={pending || !email.trim() || (review && !password)}
            >
              {pending ? (review ? '로그인 중…' : '보내는 중…') : review ? '로그인' : '코드 받기'}
            </Button>
          </form>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submitCode(token);
            }}
            className="auth-form"
            aria-busy={pending}
          >
            <div className="field-group">
              <label htmlFor="otp">인증 코드</label>
              <InputOTP
                id="otp"
                ref={tokenInput}
                aria-label="6자리 인증 코드"
                autoFocus
                maxLength={6}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                value={token}
                disabled={pending}
                aria-invalid={!!error}
                aria-describedby={error ? 'auth-error' : undefined}
                onChange={setToken}
                onComplete={(value) => void submitCode(value)}
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTP>
            </div>
            {error && (
              <p id="auth-error" role="alert" className="error-message">
                {error}
              </p>
            )}
            <Button type="submit" size="auth" disabled={pending || token.length !== 6}>
              {pending ? '확인하는 중…' : '로그인'}
            </Button>
            <div className="auth-actions">
              <Button
                variant="ghost"
                disabled={pending || remaining > 0}
                onClick={() => void resend()}
              >
                {remaining > 0 ? `코드 다시 받기 (${remaining}초)` : '코드 다시 받기'}
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  setCodeEmail(null);
                  setToken('');
                  setError('');
                }}
              >
                다른 이메일로
              </Button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
