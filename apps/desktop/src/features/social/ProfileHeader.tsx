import { useState, type ReactNode } from 'react';
import { avatarUrl, type NodiiClient } from '@nodii/api';
import { SPROUT_BODY, SPROUT_LEAVES, type SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';

/** D23: 원형 사진이 없거나 깨지면 한 가지 무채색 싹이를 그린다. */
export function Avatar({
  photoUrl,
  size,
  selected,
  label,
}: {
  photoUrl?: string;
  size: number;
  selected?: boolean;
  label: string;
}) {
  const [failed, setFailed] = useState<string>();
  return (
    <span
      role="img"
      aria-label={label}
      className="social-avatar"
      data-selected={selected}
      style={{ width: size, height: size }}
    >
      {photoUrl && failed !== photoUrl ? (
        <img src={photoUrl} alt="" onError={() => setFailed(photoUrl)} />
      ) : (
        <svg viewBox="0 0 24 24" aria-hidden="true" width="62%" height="62%">
          <path d={SPROUT_BODY} fill="var(--avatar-seed)" />
          <path d={SPROUT_LEAVES} fill="var(--avatar-leaf)" />
        </svg>
      )}
    </span>
  );
}

/** SOC-08·38: 내 탭과 다른 사람 화면에 같은 프로필 항목을 표시한다. */
export function ProfileHeader({
  client,
  profile,
  horizontal = false,
  actions,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  horizontal?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div className={`social-header${horizontal ? ' social-header-horizontal' : ''}`}>
      <Avatar
        size={horizontal ? 64 : 84}
        label={profile.nickname}
        photoUrl={
          profile.avatarPath
            ? avatarUrl(client, profile.avatarPath, horizontal ? 160 : 480)
            : undefined
        }
      />
      <div className="social-header-text">
        <h2>{profile.nickname}</h2>
        <span className="social-handle">
          {t('social.handle.display', { handle: profile.handle })}
        </span>
        {profile.bio && <p className="social-bio">{profile.bio}</p>}
      </div>
      {actions}
    </div>
  );
}
