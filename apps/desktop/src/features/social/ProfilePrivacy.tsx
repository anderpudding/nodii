import { showPublishNotice } from '../goals/publish-notice';
import {
  useBlockedProfiles,
  useUpdateDefaultVisibility,
  useUpdateSocialProfile,
  type NodiiClient,
} from '@nodii/api';
import type { DefaultVisibility, SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { SocialIcon } from './Icons';

export interface SocialSettings {
  profile: SocialProfile;
  onHandle(): void;
  onVisibility(): void;
  onBlocked(): void;
  onFriendDone?(): void;
}

/** SOC-06·28: 기존 설정의 개인정보 그룹에만 소셜 항목을 넣는다. */
export function ProfilePrivacy({
  client,
  social,
  visibility,
}: {
  client: NodiiClient;
  social: SocialSettings;
  visibility: DefaultVisibility;
}) {
  const update = useUpdateSocialProfile(client, social.profile.userId);
  const blocked = useBlockedProfiles(client, social.profile.userId);
  return (
    <section className="settings-group" aria-labelledby="social-privacy-title">
      <h3 id="social-privacy-title">{t('settings.privacy')}</h3>
      <div className="settings-card">
        <button
          type="button"
          className="settings-card-row settings-info-link"
          onClick={social.onVisibility}
        >
          <span>{t('settings.privacy.visibility')}</span>
          <span className="settings-value">
            {t(`settings.privacy.${visibility}`)} <span aria-hidden="true">›</span>
          </span>
        </button>
        <button
          type="button"
          role="switch"
          aria-checked={social.profile.searchable}
          aria-label={t('settings.privacy.searchable')}
          className="settings-card-row settings-info-link"
          disabled={update.isPending}
          onClick={() =>
            update.mutate(
              { searchable: !social.profile.searchable },
              { onError: () => toast.error(t('social.save.failed')) },
            )
          }
        >
          <span>
            {t('settings.privacy.searchable')}
            <span className="supporting">{t('settings.privacy.searchableHelp')}</span>
          </span>
          <span className="social-switch" data-on={social.profile.searchable} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="settings-card-row settings-info-link"
          onClick={social.onBlocked}
        >
          <span>{t('social.block.title')}</span>
          <span className="settings-value">
            {blocked.data && t('social.block.count', { count: blocked.data.length })}{' '}
            <span aria-hidden="true">›</span>
          </span>
        </button>
      </div>
    </section>
  );
}

/** SOC-28: 기본값 선택은 다음에 만드는 목표에만 적용한다. */
export function DefaultVisibilityScreen({
  client,
  userId,
  visibility,
}: {
  client: NodiiClient;
  userId: string;
  visibility: DefaultVisibility;
}) {
  const update = useUpdateDefaultVisibility(client, userId);
  return (
    <section className="social-detail-form">
      <h1 id="social-visibility-title">{t('settings.privacy.visibility')}</h1>
      <p className="supporting">{t('settings.privacy.visibilityHelp')}</p>
      <div
        className="social-edit-list social-radio"
        role="radiogroup"
        aria-labelledby="social-visibility-title"
      >
        {(['private', 'mutual', 'followers'] as const).map((value) => (
          <label key={value}>
            <SocialIcon
              name={value === 'private' ? 'lock' : value === 'mutual' ? 'mutual' : 'profile'}
            />
            <span>
              {t(`settings.privacy.${value}`)}
              <span className="supporting">{t(`settings.privacy.${value}Help`)}</span>
            </span>
            <input
              type="radio"
              name="social-visibility"
              value={value}
              checked={visibility === value}
              disabled={update.isPending}
              onChange={() => {
                showPublishNotice(visibility, value);
                update.mutate(value, { onError: () => toast.error(t('social.save.failed')) });
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
