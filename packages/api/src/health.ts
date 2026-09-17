export interface HealthResult {
  ok: boolean;
  /** HTTP 상태 코드. 네트워크 오류면 null */
  status: number | null;
  error?: string;
}

/**
 * Supabase Auth 헬스 체크.
 * 0단계 배포 스파이크에서 App Sandbox 안의 외부 네트워크 연결을 확인하는 데 쓴다.
 */
export async function checkSupabaseHealth(
  url: string,
  publishableKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HealthResult> {
  try {
    const response = await fetchImpl(`${url.replace(/\/+$/, '')}/auth/v1/health`, {
      headers: { apikey: publishableKey },
    });
    return { ok: response.ok, status: response.status };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
