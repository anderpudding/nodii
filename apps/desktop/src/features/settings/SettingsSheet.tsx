import { t } from '@nodii/i18n';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assertOnline,
  countAccountContents,
  deleteMyAccount,
  useGoals,
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
import { setLanguage, useLanguage } from '../../lib/language';
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
    let accountRemoved = deleted;
    try {
      if (!deleted) {
        assertOnline();
        await deleteMyAccount(client);
        setDeleted(true);
        accountRemoved = true;
      }
      await logout(client, cache, undefined, true);
      toast.success(t('settings.deleted'));
    } catch {
      toast.error(accountRemoved ? t('settings.delete.deviceFailed') : t('settings.delete.failed'));
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
        <h2 id="delete-account-title">{t('settings.delete.title')}</h2>
        <p id="delete-account-description">{t('settings.delete.description')}</p>
        {counts.data ? (
          <p className="supporting">
            {t('settings.delete.contents', {
              goals: counts.data.goals,
              todos: counts.data.todos,
              routines: counts.data.routines,
            })}
          </p>
        ) : (
          <p role="status">
            {counts.isError ? t('settings.delete.error') : t('settings.delete.checking')}
          </p>
        )}
        {counts.isError && (
          <Button variant="outline" onClick={() => void counts.refetch()}>
            {t('common.tryAgain')}
          </Button>
        )}
        <label className="field-group">
          {t('settings.delete.email')}
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
          {t('settings.delete.acknowledge')}
        </label>
        <div className="routine-actions">
          <Button
            data-initial-focus
            variant="outline"
            disabled={pending || deleted}
            onClick={onClose}
          >
            {t('mobile.add.cancel')}
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
            {pending
              ? t('settings.deleting')
              : deleted
                ? t('settings.delete.clearDevice')
                : t('settings.delete')}
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
  onOpenArchivedGoals,
}: {
  client: NodiiClient;
  session: Session;
  profile?: Profile;
  onClose: () => void;
  onOpenArchivedGoals: () => void;
}) {
  const cache = useQueryClient();
  const theme = useTheme();
  const language = useLanguage();
  const [languagePending, setLanguagePending] = useState(false);
  const [themePending, setThemePending] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 언어 전환 때 조회 상태 문구가 이전 언어로 남지 않도록 값과 상태만 보관한다.
  const [appVersion, setAppVersion] = useState<string | null | undefined>(
    isTauri() ? undefined : version,
  );
  const online = useConnectivity();
  const goals = useGoals(client);
  const archivedGoals = (goals.data ?? []).filter((goal) => goal.archivedAt).length;
  const week = useUpdateWeekStart(client, session.user.id, { onError: notifyError });
  useEffect(() => {
    if (isTauri())
      void getVersion()
        .then(setAppVersion)
        .catch(() => setAppVersion(null));
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
      <header className="settings-header">
        <span aria-hidden="true" />
        <h2 id="settings-title">{t('settings.title')}</h2>
        <Button variant="ghost" aria-label={t('settings.close')} onClick={onClose}>
          {t('common.done')}
        </Button>
      </header>
      <div className="sheet-body settings-grid">
        <div className="settings-column">
          <section className="settings-group" aria-labelledby="account-settings">
            <h3 id="account-settings">{t('settings.account')}</h3>
            <div className="settings-card">
              <div className="settings-card-row">
                <span>{t('auth.email')}</span>
                <span className="email-address settings-value">{session.user.email}</span>
              </div>
              <div className="settings-card-row">
                <div>
                  <strong>{t('auth.logout')}</strong>
                  <p className="supporting">{t('settings.logout.device')}</p>
                </div>
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    setPending(true);
                    void logout(client, cache)
                      .then(({ localOnly }) => {
                        if (localOnly) toast.success(t('auth.logout.local'));
                      })
                      .catch(() => toast.error(t('auth.logout.failed')))
                      .finally(() => setPending(false));
                  }}
                >
                  {pending ? t('settings.loggingOut') : t('auth.logout')}
                </Button>
              </div>
            </div>
          </section>

          <section className="settings-group" aria-labelledby="view-settings">
            <h3 id="view-settings">{t('settings.view')}</h3>
            <div className="settings-card">
              <div className="settings-card-row">
                <span id="week-start-label">{t('settings.weekStart')}</span>
                <div
                  className="settings-segment"
                  role="radiogroup"
                  aria-labelledby="week-start-label"
                >
                  {([t('settings.sunday'), t('settings.monday')] as const).map((label, value) => (
                    <Button
                      key={label}
                      variant="ghost"
                      role="radio"
                      aria-checked={(profile?.weekStart ?? 0) === value}
                      disabled={!profile || week.isPending || !online}
                      onClick={() => week.mutate(value as 0 | 1)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="settings-card-row">
                <span id="theme-label">{t('settings.theme')}</span>
                <div className="settings-segment" role="radiogroup" aria-labelledby="theme-label">
                  {(
                    [
                      ['system', t('settings.theme.os')],
                      ['light', t('settings.theme.light')],
                      ['dark', t('settings.theme.dark')],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      variant="ghost"
                      role="radio"
                      aria-checked={theme === value}
                      disabled={themePending}
                      onClick={() => {
                        setThemePending(true);
                        void setTheme(value as Theme)
                          .catch(() => toast.error(t('settings.theme.saveFailed')))
                          .finally(() => setThemePending(false));
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="settings-card-row">
                <span id="language-label">{t('settings.language')}</span>
                <div
                  className="settings-segment"
                  role="radiogroup"
                  aria-labelledby="language-label"
                >
                  {(
                    [
                      ['system', t('settings.language.system')],
                      ['ko', t('settings.language.ko')],
                      ['en', t('settings.language.en')],
                    ] as const
                  ).map(([value, label]) => (
                    <Button
                      key={value}
                      variant="ghost"
                      role="radio"
                      aria-checked={language === value}
                      disabled={languagePending}
                      onClick={() => {
                        setLanguagePending(true);
                        void setLanguage(value)
                          .catch(() => toast.error(t('settings.language.saveFailed')))
                          .finally(() => setLanguagePending(false));
                      }}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="settings-group" aria-labelledby="goal-settings">
            <h3 id="goal-settings">{t('routine.goal')}</h3>
            <button
              type="button"
              className="settings-card settings-link-row"
              onClick={onOpenArchivedGoals}
            >
              <span>{t('goal.archived.title')}</span>
              <span className="settings-value">{t('common.count', { count: archivedGoals })}</span>
              <span aria-hidden="true">›</span>
            </button>
          </section>

          <section className="settings-group" aria-labelledby="delete-account-settings">
            <h3 id="delete-account-settings">{t('settings.delete')}</h3>
            <div className="settings-card settings-card-row">
              <p className="supporting settings-delete-copy">{t('settings.delete.help')}</p>
              <Button
                variant="outline"
                className="danger-text"
                disabled={!online || pending}
                onClick={() => setDeleting(true)}
              >
                {t('settings.delete')}
              </Button>
            </div>
          </section>
        </div>

        <div className="settings-column">
          <section className="settings-group" aria-labelledby="shortcut-settings">
            <h3 id="shortcut-settings">{t('settings.shortcuts')}</h3>
            <div className="settings-card shortcut-list">
              {[
                [t('menu.newTodo'), ['⌘', 'N']],
                [t('settings.shortcuts.today'), ['⌘', 'T']],
                [t('settings.shortcuts.day'), ['←', '→']],
                [t('settings.shortcuts.settings'), ['⌘', ',']],
              ].map(([label, keys]) => (
                <div className="settings-card-row" key={label as string}>
                  <span>{label as string}</span>
                  <span className="shortcut-keys">
                    {(keys as string[]).map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="settings-group" aria-labelledby="info-settings">
            <h3 id="info-settings">{t('settings.info')}</h3>
            <div className="settings-card info-list">
              {links.map(({ labelKey, url }) => (
                <button
                  type="button"
                  className="settings-card-row settings-info-link"
                  key={labelKey}
                  disabled={!url}
                  onClick={() => {
                    if (url)
                      void openLink(url).catch(() => toast.error(t('settings.link.openFailed')));
                  }}
                >
                  <span>{t(labelKey)}</span>
                  <span aria-hidden="true">{url ? '↗' : t('settings.link.pending')}</span>
                </button>
              ))}
              <div className="settings-card-row">
                <span>{t('settings.version')}</span>
                <span className="settings-value version-details">
                  {appVersion === undefined
                    ? t('settings.version.checking')
                    : appVersion === null
                      ? t('settings.version.failed')
                      : appVersion}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Sheet>
  );
}
