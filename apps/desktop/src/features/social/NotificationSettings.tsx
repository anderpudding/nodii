import {
  avatarUrl,
  useFriendDoneSettings,
  useNotificationPrefs,
  useUpdateNotificationSettings,
  type NodiiClient,
} from '@nodii/api';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Avatar } from './ProfileHeader';

interface Props {
  client: NodiiClient;
  me: string;
}

function SettingSwitch({
  label,
  checked,
  disabled,
  onClick,
  children,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onClick(): void;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="settings-card-row settings-info-link"
      role="switch"
      aria-label={label}
      aria-checked={checked}
      disabled={disabled}
      onClick={onClick}
    >
      {children ?? <span>{label}</span>}
      <span className="social-switch" aria-hidden="true" data-on={checked} />
    </button>
  );
}

function SettingsFailure({ retry }: { retry(): void }) {
  return (
    <div className="settings-card-row" role="alert">
      <span>{t('social.notificationSettings.loadFailed')}</span>
      <Button variant="outline" onClick={retry}>
        {t('common.tryAgain')}
      </Button>
    </div>
  );
}

/** SOC-53: 알림 종류별 설정을 기존 설정 카드 안에서 바꾼다. */
export function NotificationSettings({
  client,
  me,
  onFriendDone,
}: Props & { onFriendDone(): void }) {
  const prefs = useNotificationPrefs(client, me);
  const friends = useFriendDoneSettings(client, me);
  const write = useUpdateNotificationSettings(client, me, () =>
    toast.error(t('social.save.failed')),
  );
  const summary = !friends.ready
    ? '–'
    : friends.global && !friends.hasOverrides
      ? t('social.notificationSettings.all')
      : friends.count
        ? t('social.notificationSettings.count', { count: friends.count })
        : t('social.notificationSettings.off');
  return (
    <section className="settings-group" aria-labelledby="notification-settings-title">
      <h3 id="notification-settings-title">{t('tabs.notifications')}</h3>
      <div className="settings-card">
        <button
          type="button"
          className="settings-card-row settings-info-link"
          onClick={onFriendDone}
        >
          <span>{t('social.notificationSettings.title')}</span>
          <span className="settings-value">
            {summary} <span aria-hidden="true">›</span>
          </span>
        </button>
        {prefs.isError ? (
          <SettingsFailure retry={() => void prefs.refetch()} />
        ) : (
          (['newFollower', 'reaction'] as const).map((key) => (
            <SettingSwitch
              key={key}
              label={t(`social.notificationSettings.${key}`)}
              checked={prefs.data?.[key] ?? true}
              disabled={!prefs.isSuccess || write.isPending}
              onClick={() => {
                if (prefs.data) write.update({ prefs: { [key]: !prefs.data[key] } });
              }}
            />
          ))
        )}
      </div>
    </section>
  );
}

/** SOC-51: 전체를 바꿔도 사람별 예외는 지우지 않는다. */
export function FriendDoneSettings({ client, me }: Props) {
  const state = useFriendDoneSettings(client, me);
  const write = useUpdateNotificationSettings(client, me, () =>
    toast.error(t('social.save.failed')),
  );
  return (
    <section
      className="social-detail-form friend-done-settings"
      aria-labelledby="friend-done-heading"
    >
      <h1 id="friend-done-heading">{t('social.notificationSettings.title')}</h1>
      {state.failed ? (
        <SettingsFailure retry={state.reload} />
      ) : !state.ready ? (
        <p role="status">{t('day.loading')}</p>
      ) : (
        <>
          <div className="settings-card">
            <SettingSwitch
              label={t('social.notificationSettings.allFriends')}
              checked={!!state.global}
              disabled={write.isPending}
              onClick={() => write.update({ prefs: { friendDone: !state.global } })}
            />
          </div>
          <p className="supporting">{t('social.notificationSettings.help')}</p>
          {state.people?.length ? (
            <section className="settings-group" aria-labelledby="per-person-heading">
              <h3 id="per-person-heading">{t('social.notificationSettings.byPerson')}</h3>
              <div className="settings-card">
                {state.people.map(({ profile, overridden, checked }) => (
                  <SettingSwitch
                    key={profile.userId}
                    label={profile.nickname}
                    checked={checked}
                    disabled={write.isPending}
                    onClick={() =>
                      write.update({
                        actorId: profile.userId,
                        friendDone: !checked,
                        global: !!state.global,
                      })
                    }
                  >
                    <div className="notification-settings-person">
                      <Avatar
                        size={40}
                        label={profile.nickname}
                        photoUrl={
                          profile.avatarPath
                            ? avatarUrl(client, profile.avatarPath, 160)
                            : undefined
                        }
                      />
                      <div>
                        <span>{profile.nickname}</span>
                        <span className="supporting">
                          {t('social.handle.display', { handle: profile.handle })}
                        </span>
                        {overridden && (
                          <span className="notification-override">
                            {t('social.notificationSettings.override')}
                          </span>
                        )}
                      </div>
                    </div>
                  </SettingSwitch>
                ))}
              </div>
            </section>
          ) : (
            <p className="supporting">{t('social.notificationSettings.noFollowing')}</p>
          )}
        </>
      )}
    </section>
  );
}
