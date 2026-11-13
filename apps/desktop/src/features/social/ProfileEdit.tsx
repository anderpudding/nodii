import { useEffect, useRef, useState } from 'react';
import { avatarUrl, type NodiiClient } from '@nodii/api';
import type { SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Avatar } from './ProfileHeader';
import { AvatarCrop, readAvatarFile } from './AvatarCrop';
import { SocialIcon } from './Icons';
import { cooldownDays, profileFields, type ProfileField } from './ProfileForms';

/** SOC-01·04: 사진과 개별 편집 항목을 한 곳에서 연다. */
export function ProfileEdit({
  client,
  profile,
  onField,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  onField(field: ProfileField): void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<Awaited<ReturnType<typeof readAvatarFile>> | null>();
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(
    () => () => {
      if (source) URL.revokeObjectURL(source.url);
    },
    [source],
  );
  const days = cooldownDays(profile);
  async function choose(file: File | undefined) {
    if (!file) return;
    try {
      const value = await readAvatarFile(file);
      if (live.current) setSource(value);
      else URL.revokeObjectURL(value.url);
    } catch {
      if (live.current) toast.error(t('social.photo.invalid'));
    }
  }
  return (
    <div className="social-detail-form social-edit">
      <h1>{t('social.edit')}</h1>
      {profile.autoHiddenAt && (
        <p role="status" className="social-note">
          {t('social.profile.hidden')}
        </p>
      )}
      <div className="social-photo-picker">
        <button
          type="button"
          aria-label={t('social.photo.change')}
          onClick={() => input.current?.click()}
        >
          <Avatar
            size={84}
            label={profile.nickname}
            photoUrl={profile.avatarPath ? avatarUrl(client, profile.avatarPath, 480) : undefined}
          />
          <span className="social-camera">
            <SocialIcon name="camera" size={16} />
          </span>
        </button>
        <div>
          <Button variant="outline" onClick={() => input.current?.click()}>
            {t('social.photo.changeDesktop')}
          </Button>
          <p className="supporting">{t('social.photo.formats')}</p>
          {profile.avatarPath && (
            <Button variant="ghost" onClick={() => setSource(null)}>
              {t('social.photo.reset')}
            </Button>
          )}
        </div>
        <input
          ref={input}
          hidden
          type="file"
          accept="image/jpeg,image/heic,image/heif,image/png"
          onChange={(event) => {
            void choose(event.currentTarget.files?.[0]);
            event.currentTarget.value = '';
          }}
        />
      </div>
      <div className="social-edit-list">
        {profileFields.map((field) => (
          <button type="button" key={field} onClick={() => onField(field)}>
            <span>{t(`social.${field}`)}</span>
            <span className="social-current">
              {field === 'handle'
                ? t('social.handle.display', { handle: profile.handle })
                : profile[field]}
            </span>
            {field === 'handle' && days ? (
              <span className="social-hint">
                <SocialIcon name="lock" size={16} />
                {t('social.handle.days', { days })}
              </span>
            ) : (
              <span aria-hidden="true">›</span>
            )}
          </button>
        ))}
      </div>
      {source !== undefined && (
        <AvatarCrop
          client={client}
          userId={profile.userId}
          source={source}
          hasPhoto={!!profile.avatarPath}
          onClose={() => setSource(undefined)}
        />
      )}
    </div>
  );
}
