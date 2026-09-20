import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assertOnline,
  countAccountContents,
  deleteMyAccount,
  useUpdateWeekStart,
  type NodiiClient,
  type Session,
} from '@nodii/api';
import type { Profile } from '@nodii/core';
import { getVersion } from '@tauri-apps/api/app';
import { isTauri } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { version } from '../../../package.json';
import { Sheet } from '../../components/ui/sheet';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { logout } from '../../lib/logout';
import { links, openLink } from '../../lib/links';
import { setTheme, useTheme, type Theme } from '../../lib/theme';
import { notifyError } from '../../lib/notify-error';
import { useConnectivity } from '../../lib/connectivity';

/** AUTH-06: 개수·이메일·이해 확인을 마친 뒤에만 계정 삭제 요청을 보낸다. */
function DeleteAccount({
  client,
  email,
  onClose,
}: {
  client: NodiiClient;
  email: string;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const [confirmation, setConfirmation] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const online = useConnectivity();
  const counts = useQuery({
    queryKey: ['accountContents'],
    queryFn: ({ signal }) => countAccountContents(client, signal),
    staleTime: 0,
  });
  async function remove() {
    setPending(true);
    try {
      if (!deleted) {
        assertOnline();
        await deleteMyAccount(client);
        setDeleted(true);
      }
      await logout(client, cache, undefined, true);
      toast.success('계정을 삭제했어요');
    } catch {
      toast.error(
        deleted
          ? '이 기기의 정보를 지우지 못했어요. 다시 시도해 주세요.'
          : '계정을 삭제하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <Sheet
      role="alertdialog"
      className="routine-modal"
      labelledBy="delete-account-title"
      describedBy="delete-account-description"
      onClose={() => {
        if (!pending && !deleted) onClose();
      }}
    >
      <div className="routine-form">
        <h2 id="delete-account-title">계정을 삭제할까요?</h2>
        <p id="delete-account-description">
          모든 목표·할 일·루틴이 영구 삭제되고 되돌릴 수 없어요.
        </p>
        {counts.data ? (
          <p className="supporting">
            목표 {counts.data.goals}개 · 할 일 {counts.data.todos}개 · 루틴 {counts.data.routines}
            개와 모든 완료 기록이 삭제돼요.
          </p>
        ) : (
          <p role="status">
            {counts.isError ? '삭제할 개수를 불러오지 못했어요.' : '삭제할 개수를 확인하고 있어요…'}
          </p>
        )}
        {counts.isError && (
          <Button variant="outline" onClick={() => void counts.refetch()}>
            다시 시도
          </Button>
        )}
        <label className="field-group">
          이메일 주소를 다시 입력해 주세요
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={pending || deleted}
            autoComplete="off"
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={understood}
            onChange={(event) => setUnderstood(event.target.checked)}
            disabled={pending || deleted}
          />{' '}
          되돌릴 수 없다는 걸 이해했어요
        </label>
        <div className="routine-actions">
          <Button
            data-initial-focus
            variant="outline"
            disabled={pending || deleted}
            onClick={onClose}
          >
            취소
          </Button>
          <Button
            className="routine-danger"
            disabled={
              pending ||
              (!deleted &&
                (!online ||
                  !counts.data ||
                  counts.isFetching ||
                  !understood ||
                  !email ||
                  confirmation.trim() !== email))
            }
            onClick={() => void remove()}
          >
            {pending ? '삭제 중…' : deleted ? '이 기기 정보 지우기' : '계정 삭제'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** SET-01/02/07: 기기 설정과 계정 설정을 기존 시트 안에서 구분해 보여준다. */
export function SettingsSheet({
  client,
  session,
  profile,
  onClose,
}: {
  client: NodiiClient;
  session: Session;
  profile?: Profile;
  onClose: () => void;
}) {
  const cache = useQueryClient();
  const theme = useTheme();
  const [themePending, setThemePending] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [appVersion, setAppVersion] = useState(isTauri() ? '확인 중…' : version);
  const online = useConnectivity();
  const week = useUpdateWeekStart(client, session.user.id, { onError: notifyError });
  useEffect(() => {
    if (isTauri())
      void getVersion()
        .then(setAppVersion)
        .catch(() => setAppVersion('확인하지 못했어요'));
  }, []);
  if (deleting)
    return (
      <DeleteAccount
        client={client}
        email={session.user.email ?? ''}
        onClose={() => setDeleting(false)}
      />
    );
  return (
    <Sheet labelledBy="settings-title" className="settings-sheet" onClose={onClose}>
      <header className="goal-sheet-header">
        <h2 id="settings-title">설정</h2>
        <Button variant="ghost" aria-label="설정 닫기" onClick={onClose}>
          닫기
        </Button>
      </header>
      <section className="settings-section" aria-labelledby="view-settings">
        <h3 id="view-settings">보기</h3>
        <label className="settings-row">
          주 시작 요일
          <select
            className="input"
            value={profile?.weekStart ?? 0}
            disabled={!profile || week.isPending || !online}
            onChange={(event) => week.mutate(Number(event.target.value) as 0 | 1)}
          >
            <option value={0}>일요일</option>
            <option value={1}>월요일</option>
          </select>
        </label>
        <label className="settings-row">
          테마
          <select
            className="input"
            value={theme}
            disabled={themePending}
            onChange={(event) => {
              setThemePending(true);
              void setTheme(event.target.value as Theme)
                .catch(() => toast.error('테마를 저장하지 못했어요'))
                .finally(() => setThemePending(false));
            }}
          >
            <option value="system">시스템</option>
            <option value="light">라이트</option>
            <option value="dark">다크</option>
          </select>
        </label>
      </section>
      <section className="settings-section" aria-labelledby="account-settings">
        <h3 id="account-settings">계정</h3>
        <p className="email-address">{session.user.email}</p>
        <p className="supporting">로그아웃하면 이 기기에 저장된 캐시도 지워져요.</p>
        <div className="settings-row">
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void logout(client, cache)
                .then(({ localOnly }) => {
                  if (localOnly) toast.success('이 기기에서 로그아웃했어요');
                })
                .catch(() => toast.error('로그아웃하지 못했어요. 다시 시도해 주세요.'))
                .finally(() => setPending(false));
            }}
          >
            {pending ? '로그아웃 중…' : '로그아웃'}
          </Button>
          <Button
            variant="ghost"
            className="danger-text"
            disabled={!online || pending}
            onClick={() => setDeleting(true)}
          >
            계정 삭제
          </Button>
        </div>
      </section>
      <section className="settings-section" aria-labelledby="shortcut-settings">
        <h3 id="shortcut-settings">단축키</h3>
        <p className="supporting">⌘N 새 할 일 · ⌘T 오늘로 · ←/→ 이전·다음 날 · ⌘, 설정</p>
      </section>
      <section className="settings-section" aria-labelledby="info-settings">
        <h3 id="info-settings">정보</h3>
        <div className="routine-choices">
          {links.map(({ label, url }) => (
            <Button
              key={label}
              variant="ghost"
              disabled={!url}
              onClick={() => {
                if (url) void openLink(url).catch(() => toast.error('링크를 열지 못했어요'));
              }}
            >
              {label}
              {!url && ' · 준비 중'}
            </Button>
          ))}
        </div>
        <p className="supporting version-details">버전 {appVersion}</p>
      </section>
    </Sheet>
  );
}
