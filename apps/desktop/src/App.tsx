import { checkSupabaseHealth } from '@nodii/api';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { env } from './lib/env';
import { getSessionStore } from './lib/tauri-store';

/**
 * 0단계 배포 스파이크 화면.
 * TestFlight 설치본(App Sandbox)에서 외부 네트워크와 로컬 저장소가 동작하는지 확인한다.
 * 2단계에서 로그인 화면과 앱 레이아웃으로 교체한다.
 */

type CheckResult = { status: 'ok' | 'fail' | 'skipped'; detail: string };
type Checks = { network: CheckResult; storage: CheckResult };

async function checkNetwork(): Promise<CheckResult> {
  if (!env.isSupabaseConfigured) {
    return { status: 'skipped', detail: '.env.local에 Supabase URL과 키가 없습니다' };
  }
  const result = await checkSupabaseHealth(env.supabaseUrl, env.supabasePublishableKey);
  if (result.ok) return { status: 'ok', detail: `${env.supabaseUrl} · HTTP ${result.status}` };
  return {
    status: 'fail',
    detail: result.status === null ? `연결 실패: ${result.error}` : `HTTP ${result.status}`,
  };
}

async function checkStorage(): Promise<CheckResult> {
  if (!isTauri()) {
    return { status: 'skipped', detail: '브라우저 미리보기에서는 확인하지 않습니다' };
  }
  try {
    const store = await getSessionStore();
    const previous = await store.get<string>('spike.lastRunAt');
    const now = new Date().toISOString();
    await store.set('spike.lastRunAt', now);
    await store.save();
    const readBack = await store.get<string>('spike.lastRunAt');
    if (readBack !== now) return { status: 'fail', detail: '저장한 값을 다시 읽지 못했습니다' };
    return {
      status: 'ok',
      detail: previous
        ? `이전 실행 기록: ${previous}`
        : '첫 실행 (앱을 재시작하면 이전 기록이 보여야 합니다)',
    };
  } catch (error) {
    return { status: 'fail', detail: error instanceof Error ? error.message : String(error) };
  }
}

async function runChecks(): Promise<Checks> {
  const [network, storage] = await Promise.all([checkNetwork(), checkStorage()]);
  return { network, storage };
}

const STATUS_LABEL: Record<CheckResult['status'], string> = {
  ok: '성공',
  fail: '실패',
  skipped: '건너뜀',
};

const STATUS_STYLE: Record<CheckResult['status'], string> = {
  ok: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  fail: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300',
  skipped: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

function CheckRow({ label, result }: { label: string; result: CheckResult | null }) {
  return (
    <li className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="font-medium">{label}</p>
        <p className="mt-0.5 truncate text-sm text-zinc-500">{result?.detail ?? '확인 중…'}</p>
      </div>
      {result && (
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[result.status]}`}
        >
          {STATUS_LABEL[result.status]}
        </span>
      )}
    </li>
  );
}

export function App() {
  const [version, setVersion] = useState<string | null>(null);
  const [checks, setChecks] = useState<Checks | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const appVersion = isTauri() ? getVersion() : Promise.resolve('웹 미리보기');
    void Promise.all([appVersion, runChecks()]).then(([v, result]) => {
      if (cancelled) return;
      setVersion(v);
      setChecks(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const rerun = async () => {
    setRunning(true);
    setChecks(null);
    setChecks(await runChecks());
    setRunning(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <section className="w-full max-w-md">
        <h1 className="text-3xl font-bold tracking-tight">Nodii</h1>
        <p className="mt-1 text-sm text-zinc-500">배포 스파이크 · v{version ?? '…'}</p>

        <ul className="mt-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white px-4 dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          <CheckRow label="외부 네트워크 (Supabase)" result={checks?.network ?? null} />
          <CheckRow label="로컬 저장소 (plugin-store)" result={checks?.storage ?? null} />
        </ul>

        <button
          type="button"
          onClick={() => void rerun()}
          disabled={running}
          className="mt-4 rounded-lg bg-[#4F7CFF] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          다시 확인
        </button>
      </section>
    </main>
  );
}
