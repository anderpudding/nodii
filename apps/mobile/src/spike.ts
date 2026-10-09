import { checkSupabaseHealth, createNodiiClient, type HealthResult } from '@nodii/api';
import { occursOn, todayISO, type Routine } from '@nodii/core';
import { secureStoreAuthStorage } from '../lib/secure-store';

const LAST_RUN_KEY = 'spike.lastRunAt';
const SIZE_PROBE_KEY = 'spike.secureStoreSizeProbe';
const SECURE_STORE_PROBE_BYTES = 2_048;
const FALLBACK_URL = 'https://example.supabase.co';
const FALLBACK_KEY = 'spike-missing-publishable-key';

export interface CoreSpikeResult {
  date: string;
  occurs: boolean;
}

export interface NetworkSpikeResult {
  configured: boolean;
  health: HealthResult | null;
}

export interface StorageSpikeResult {
  previousRunAt: string | null;
  savedRunAt: string;
}

/** M0: 공유 core가 RN 런타임에서 날짜와 반복 규칙을 실제 계산하는지 확인한다. */
export function runCoreSpike(timeZone: string, now: Date): CoreSpikeResult {
  const date = todayISO(timeZone, now);
  const sample: Routine = {
    id: 'spike-routine',
    goalId: 'spike-goal',
    title: 'spike',
    freq: 'daily',
    repeatEvery: 1,
    byWeekday: null,
    byMonthday: null,
    startDate: date,
    endDate: null,
    sortKey: 'a0',
  };
  return { date, occurs: occursOn(sample, date) };
}

/** M0: API 클라이언트 생성과 Supabase Auth 헬스 엔드포인트를 함께 확인한다. */
export async function runNetworkSpike(): Promise<NetworkSpikeResult> {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
  const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
  const configured = url.length > 0 && publishableKey.length > 0;

  createNodiiClient({
    url: configured ? url : FALLBACK_URL,
    publishableKey: configured ? publishableKey : FALLBACK_KEY,
    storage: secureStoreAuthStorage,
  });

  if (!configured) return { configured, health: null };
  return { configured, health: await checkSupabaseHealth(url, publishableKey) };
}

/** M0: 2KB 값의 왕복과 재실행 기록 보존을 실제 Keychain 저장소에서 확인한다. */
export async function runStorageSpike(now: Date): Promise<StorageSpikeResult> {
  const previousRunAt = await secureStoreAuthStorage.getItem(LAST_RUN_KEY);
  const probe = 'N'.repeat(SECURE_STORE_PROBE_BYTES);

  await secureStoreAuthStorage.setItem(SIZE_PROBE_KEY, probe);
  const savedProbe = await secureStoreAuthStorage.getItem(SIZE_PROBE_KEY);
  await secureStoreAuthStorage.removeItem(SIZE_PROBE_KEY);
  if (savedProbe !== probe) throw new Error('secure_store_probe_mismatch');

  const savedRunAt = now.toISOString();
  await secureStoreAuthStorage.setItem(LAST_RUN_KEY, savedRunAt);
  if ((await secureStoreAuthStorage.getItem(LAST_RUN_KEY)) !== savedRunAt) {
    throw new Error('secure_store_last_run_mismatch');
  }

  return { previousRunAt, savedRunAt };
}
