import { useEffect, useState } from 'react';
import { compareVersion } from '@nodii/core';
import {
  fetchMinAppVersion,
  syncProfileTimezone,
  readStoredSession,
  normalizeAuthError,
  type NodiiClient,
  type Session,
} from '@nodii/api';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { onlineManager, useQuery, useQueryClient } from '@tanstack/react-query';
import { version } from '../../package.json';
import { env } from '../lib/env';
import { Login } from '../features/auth/Login';
import { MainLayout } from './MainLayout';
import { UpdateRequired } from './UpdateRequired';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { UserCache } from './UserCache';
import { detachPersistedCache } from '../lib/query-persister';

// StrictMode의 setup/cleanup도 같은 SDK 타이머를 순서대로 시작·정지한다.
const refreshQueues = new WeakMap<NodiiClient, Promise<void>>();
function updateAuthRefresh(client: NodiiClient, enabled: boolean) {
  const next = (refreshQueues.get(client) ?? Promise.resolve()).then(() =>
    enabled ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh(),
  );
  refreshQueues.set(
    client,
    next.catch(() => {
      toast.error('로그인 상태를 갱신하지 못했어요. 앱을 다시 열어 주세요.');
    }),
  );
}

function SignedIn({ client, session }: { client: NodiiClient; session: Session }) {
  // 계정 삭제/로그아웃에서 멈춘 갱신은 다시 인증된 화면이 열릴 때만 재개한다.
  useEffect(() => {
    const update = () => {
      updateAuthRefresh(client, document.visibilityState !== 'hidden');
    };
    update();
    document.addEventListener('visibilitychange', update);
    return () => {
      document.removeEventListener('visibilitychange', update);
      updateAuthRefresh(client, false);
    };
  }, [client]);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // G2의 쓰기는 로그인 진행과 독립적이며 실패하면 Query가 재시도한다.
  const profile = useQuery({
    queryKey: ['profile', session.user.id, timezone],
    queryFn: ({ signal }) => syncProfileTimezone(client, session.user.id, timezone, signal),
    retry: 2,
    staleTime: Infinity,
  });
  return (
    <MainLayout
      client={client}
      session={session}
      profile={profile.data}
      profileError={profile.isError}
      retryProfile={() => {
        void profile.refetch();
      }}
    />
  );
}

/** I6: 라우터 없이 버전 검사 → 인증 → 메인 화면 순서로 진입을 제어한다. */
export function AppGate({
  client,
  appVersion,
  appStoreId = env.appStoreId,
  reviewAccountEmail = env.reviewAccountEmail,
}: {
  client: NodiiClient;
  appVersion?: string;
  appStoreId?: string;
  reviewAccountEmail?: string;
}) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [sessionError, setSessionError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const check = useQuery({
    queryKey: ['appVersionCheck', appVersion ?? version],
    queryFn: async () => {
      const [minimum, current] = await Promise.all([
        fetchMinAppVersion(client),
        appVersion
          ? Promise.resolve(appVersion)
          : isTauri()
            ? getVersion().catch(() => null)
            : Promise.resolve(version),
      ]);
      try {
        return minimum && current && compareVersion(current, minimum) < 0
          ? { minimum, current }
          : null;
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: Infinity,
    networkMode: 'always',
  });

  useEffect(() => {
    let active = true;
    let authEventReceived = false;
    let resolvedSession = false;
    let previousUser: string | undefined;
    function applySession(next: Session | null) {
      if (!active) return;
      if (previousUser && previousUser !== next?.user.id) {
        void detachPersistedCache(queryClient).catch(() =>
          toast.error('이 기기의 캐시를 지우지 못했어요'),
        );
        queryClient.clear();
      }
      previousUser = next?.user.id;
      setSessionError(false);
      setSession(next);
    }
    const localLogout = () => {
      authEventReceived = true;
      applySession(null);
    };
    window.addEventListener('nodii:signed-out', localLogout);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((event, next) => {
      // SDK 내부 잠금 중에는 다른 Supabase 메서드를 await하지 않는다.
      if (event !== 'INITIAL_SESSION') authEventReceived = true;
      if (event === 'INITIAL_SESSION' && !next && !onlineManager.isOnline()) return;
      if (event !== 'INITIAL_SESSION' || !authEventReceived) {
        resolvedSession = true;
        applySession(next);
      }
    });
    void readStoredSession(client)
      .then((stored) => {
        if (active && stored && !resolvedSession && !authEventReceived) applySession(stored);
      })
      .catch(() => {
        /* SDK의 세션 읽기 결과가 오류와 재시도 UI를 결정한다. */
      });
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || authEventReceived) return;
        if (error) {
          if (previousUser && normalizeAuthError(error).code === 'network') return;
          setSessionError(true);
        } else {
          if (!data.session && previousUser && !onlineManager.isOnline()) return;
          resolvedSession = true;
          applySession(data.session);
        }
      })
      .catch(() => {
        if (active && !authEventReceived) setSessionError(true);
      });
    return () => {
      active = false;
      window.removeEventListener('nodii:signed-out', localLogout);
      subscription.unsubscribe();
    };
  }, [client, queryClient, attempt]);

  if (check.isPending && !session)
    return (
      <main className="center-screen">
        <p role="status" className="supporting">
          Nodii를 준비하고 있어요…
        </p>
      </main>
    );
  if (check.data)
    return (
      <UpdateRequired
        currentVersion={check.data.current}
        minimumVersion={check.data.minimum}
        appStoreId={appStoreId}
      />
    );
  if (sessionError)
    return (
      <main className="center-screen">
        <section className="auth-panel">
          <p role="alert">로그인 정보를 불러오지 못했어요.</p>
          <Button
            onClick={() => {
              setSessionError(false);
              setAttempt((value) => value + 1);
            }}
          >
            다시 시도
          </Button>
        </section>
      </main>
    );
  if (session === undefined)
    return (
      <main className="center-screen">
        <p role="status" className="supporting">
          로그인 정보를 확인하고 있어요…
        </p>
      </main>
    );
  return session ? (
    <UserCache key={session.user.id} userId={session.user.id}>
      <SignedIn client={client} session={session} />
    </UserCache>
  ) : (
    <Login client={client} reviewAccountEmail={reviewAccountEmail} />
  );
}
