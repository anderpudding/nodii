import { useEffect, useRef, useState } from 'react';
import { useNotificationPrefs, useNotifications, useRelations, type NodiiClient } from '@nodii/api';
import {
  filterNotifications,
  groupNotifications,
  NOTIFICATION_FILTERS,
  NOTIFICATION_SECTIONS,
  type NotificationFilter,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { Button } from '../../components/ui/button';
import { SocialIcon } from './Icons';
import { onSocialForeground } from './InviteReceiver';
import { NotificationRow } from './NotificationRow';

const promptKey = 'nodii:friend-completion-prompt-dismissed';

interface Props {
  client: NodiiClient;
  me: string;
  timezone: string;
  weekStart: 0 | 1;
  following: boolean;
  onPerson(id: string): void;
  onToday(date: string): void;
  onSettings(): void;
}

/** SOC-50·56: 필터와 시간 구간을 최근 서버 목록에 적용한다. */
export function Notifications({
  client,
  me,
  timezone,
  weekStart,
  following,
  onPerson,
  onToday,
  onSettings,
}: Props) {
  const query = useNotifications(client, me, onSocialForeground);
  const prefs = useNotificationPrefs(client, me);
  const [kind, setKind] = useState<NotificationFilter>('all');
  const [now, setNow] = useState(() => new Date());
  const filters = useRef<HTMLDivElement>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(promptKey) === '1';
    } catch {
      return false;
    }
  });
  const rows = query.data ?? [];
  const relations = useRelations(
    client,
    me,
    rows.filter((row) => row.kind === 'follow').map((row) => row.actorId),
  );
  const visible = filterNotifications(rows, kind);
  const groups = groupNotifications(visible, now, timezone, weekStart);
  const { refetch } = query;
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    const foreground = onSocialForeground(() => setNow(new Date()));
    const keydown = (event: KeyboardEvent) => {
      if (
        !event.defaultPrevented &&
        event.metaKey &&
        event.key.toLowerCase() === 'r' &&
        !document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')
      ) {
        event.preventDefault();
        setNow(new Date());
        void refetch();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => {
      window.clearInterval(timer);
      foreground();
      window.removeEventListener('keydown', keydown);
    };
  }, [refetch]);
  return (
    <section className="social-notifications" aria-label={t('tabs.notifications')}>
      <header className="notification-header">
        <h1>{t('tabs.notifications')}</h1>
        <div
          className="notification-filters"
          ref={filters}
          role="tablist"
          aria-label={t('social.notifications.filter.all')}
        >
          {NOTIFICATION_FILTERS.map((filter, index) => (
            <button
              key={filter}
              type="button"
              role="tab"
              id={`notification-filter-${filter}`}
              aria-controls="notification-results"
              tabIndex={kind === filter ? 0 : -1}
              aria-selected={kind === filter}
              onClick={() => setKind(filter)}
              onKeyDown={(e) => {
                const length = NOTIFICATION_FILTERS.length;
                const next =
                  e.key === 'Home'
                    ? 0
                    : e.key === 'End'
                      ? length - 1
                      : e.key === 'ArrowLeft'
                        ? (index - 1 + length) % length
                        : e.key === 'ArrowRight'
                          ? (index + 1) % length
                          : null;
                if (next === null) return;
                e.stopPropagation();
                e.preventDefault();
                setKind(NOTIFICATION_FILTERS[next]!);
                filters.current?.querySelectorAll('button')[next]?.focus();
              }}
            >
              {t(`social.notifications.filter.${filter}`)}
            </button>
          ))}
        </div>
      </header>
      <div
        role="tabpanel"
        id="notification-results"
        aria-labelledby={`notification-filter-${kind}`}
        className="notification-results"
      >
        {query.isError ? (
          <div className="social-center">
            <p role="alert">{t('social.notifications.loadFailed')}</p>
            <Button variant="outline" onClick={() => void refetch()}>
              {t('common.tryAgain')}
            </Button>
          </div>
        ) : !query.data ? (
          <p className="social-center" role="status">
            {t('day.loading')}
          </p>
        ) : visible.length === 0 ? (
          <p className="social-center">
            {t(kind === 'all' ? 'social.notifications.empty' : 'social.notifications.filterEmpty')}
          </p>
        ) : (
          NOTIFICATION_SECTIONS.map(
            (section) =>
              groups[section].length > 0 && (
                <section
                  className="notification-section"
                  key={section}
                  aria-labelledby={`notification-section-${section}`}
                >
                  <h2 id={`notification-section-${section}`}>
                    {t(`social.notifications.section.${section}`)}
                  </h2>
                  <ul>
                    {groups[section].map((row) => (
                      <NotificationRow
                        key={row.id}
                        client={client}
                        me={me}
                        row={row}
                        section={section}
                        now={now}
                        timeZone={timezone}
                        relation={relations.data?.get(row.actorId)}
                        onPerson={onPerson}
                        onToday={onToday}
                      />
                    ))}
                  </ul>
                </section>
              ),
          )
        )}
        {!dismissed &&
          following &&
          prefs.data?.friendDone === false &&
          query.data &&
          !query.isError && (
            <aside className="notification-prompt">
              <p>{t('social.notifications.prompt')}</p>
              <Button variant="outline" onClick={onSettings}>
                {t('social.notifications.enable')}
              </Button>
              <button
                type="button"
                aria-label={t('social.notifications.dismiss')}
                onClick={() => {
                  setDismissed(true);
                  try {
                    localStorage.setItem(promptKey, '1');
                  } catch {
                    /* 이 창에서는 닫힌 상태를 유지한다. */
                  }
                }}
              >
                <SocialIcon name="close" size={20} />
              </button>
            </aside>
          )}
      </div>
    </section>
  );
}
