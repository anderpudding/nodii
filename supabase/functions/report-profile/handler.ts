const reasons = ['spam', 'offensive', 'impersonation', 'harassment', 'other'] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Report = {
  id: string;
  reporterId: string;
  targetUserId: string;
  handle: string;
  reason: (typeof reasons)[number];
  detail: string | null;
  createdAt: string;
};

interface ReportServices {
  userId(): Promise<string | null>;
  targetHandle(targetId: string): Promise<string | null>;
  hasRecentReport(reporterId: string, targetId: string, since: string): Promise<boolean>;
  save(report: Report): Promise<void>;
  send(report: Report): Promise<void>;
  log(message: string, reportId?: string): void;
}

/** SOC-62: 메일 실패 뒤에도 저장한 신고는 운영자가 처리할 수 있다. */
export async function handleReport(
  request: Request,
  servicesFor: (authorization: string) => ReportServices,
): Promise<Response> {
  const json = (value: object, status = 200) => Response.json(value, { status, headers });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'unauthorized' }, 401);
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== 'object' || !('targetUserId' in body) || !('reason' in body))
    return json({ error: 'invalid_input' }, 400);
  const targetUserId = typeof body.targetUserId === 'string' ? body.targetUserId.toLowerCase() : '';
  const reason = reasons.find((value) => value === body.reason);
  const raw = 'detail' in body ? body.detail : undefined;
  const detail = typeof raw === 'string' ? raw.trim() : '';
  if (
    !reason ||
    !uuid.test(targetUserId) ||
    (raw !== undefined && typeof raw !== 'string') ||
    [...detail].length > 500 ||
    (reason === 'other' && !detail)
  ) {
    return json({ error: 'invalid_input' }, 400);
  }

  const services = servicesFor(authorization);
  try {
    const reporterId = await services.userId();
    if (!reporterId) return json({ error: 'unauthorized' }, 401);
    if (reporterId === targetUserId) return json({ error: 'self_report' }, 403);
    const now = new Date();
    const since = new Date(now.getTime() - 10 * 60_000).toISOString();
    if (await services.hasRecentReport(reporterId, targetUserId, since)) return json({ ok: true });
    const handle = await services.targetHandle(targetUserId);
    if (!handle) return json({ error: 'not_found' }, 404);
    const report: Report = {
      id: crypto.randomUUID(),
      reporterId,
      targetUserId,
      handle,
      reason,
      detail: detail || null,
      createdAt: now.toISOString(),
    };
    await services.save(report);
    try {
      await services.send(report);
    } catch {
      services.log('report_email_failed', report.id);
    }
    return json({ ok: true });
  } catch {
    services.log('report_save_failed');
    return json({ error: 'save_failed' }, 500);
  }
}
