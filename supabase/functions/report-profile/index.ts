/* global Deno */
import { createClient } from 'npm:@supabase/supabase-js@2.116.0';
import { handleReport } from './handler.ts';

Deno.serve((request) =>
  handleReport(request, (authorization) => {
    const url = Deno.env.get('SUPABASE_URL')!;
    const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      async userId() {
        const { data, error } = await client.auth.getUser(authorization.slice('Bearer '.length));
        return error ? null : (data.user?.id ?? null);
      },
      async targetHandle(targetId) {
        const { data, error } = await client
          .from('social_profiles')
          .select('handle')
          .eq('user_id', targetId)
          .maybeSingle();
        if (error) throw error;
        return data?.handle ?? null;
      },
      async hasRecentReport(reporterId, targetId, since) {
        // 신고 원본은 RLS가 숨긴다. 서비스 역할은 이 조건의 개수 조회에만 사용한다.
        const reader = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { count, error } = await reader
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('reporter_id', reporterId)
          .eq('target_user_id', targetId)
          .eq('target_kind', 'profile')
          .gte('created_at', since);
        if (error) throw error;
        return (count ?? 0) > 0;
      },
      async save(report) {
        const { error } = await client.from('reports').insert({
          id: report.id,
          reporter_id: report.reporterId,
          target_user_id: report.targetUserId,
          target_kind: 'profile',
          reason: report.reason,
          detail: report.detail,
        });
        if (error) throw error;
      },
      async send(report) {
        const key = Deno.env.get('RESEND_API_KEY');
        if (!key) {
          console.info('report_email_dry_run', report.id);
          return;
        }
        const inbox = Deno.env.get('REPORT_INBOX');
        if (!inbox) throw new Error('missing_report_inbox');
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(10_000),
          body: JSON.stringify({
            from: 'no-reply@mail.nodii.app',
            to: [inbox],
            subject: `[Nodii report] ${report.reason} — @${report.handle}`,
            text: [
              `Report ID: ${report.id}`,
              `Reason: ${report.reason}`,
              `Detail: ${report.detail ?? ''}`,
              `Target user ID: ${report.targetUserId}`,
              `ID: @${report.handle}`,
              `Reported at (UTC): ${report.createdAt}`,
              'Studio saved query: reports-open',
            ].join('\n'),
          }),
        });
        if (!response.ok) throw new Error(`email_http_${response.status}`);
      },
      log(message, reportId) {
        console.error(message, reportId ?? '');
      },
    };
  }),
);
