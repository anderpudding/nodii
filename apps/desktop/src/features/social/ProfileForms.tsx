import { useState, type FormEvent, type ReactNode } from 'react';
import {
  type NodiiClient,
  socialErrorCode,
  useCreateSocialProfile,
  useHandleAvailability,
  useProfileTextCheck,
  useUpdateSocialProfile,
} from '@nodii/api';
import {
  handleChangeAvailableAt,
  validateBio,
  validateHandle,
  validateNickname,
  type SocialProfile,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { Button } from '../../components/ui/button';
import { toast } from 'sonner';
import { Avatar } from './ProfileHeader';
import { SocialIcon } from './Icons';

export const profileFields = ['nickname', 'handle', 'bio'] as const;
export type ProfileField = (typeof profileFields)[number];

/** SOC-02: 남은 시간은 날짜가 아닌 서버 변경 시각으로 계산한다. */
export function cooldownDays(profile: SocialProfile) {
  const now = Date.now();
  const end = handleChangeAvailableAt(profile.handleChangedAt, now);
  return end ? Math.ceil((end - now) / 86_400_000) : 0;
}

function HandleHint({ status }: { status: ReturnType<typeof useHandleAvailability> }) {
  if (!status) return null;
  const neutral = status === 'checking' || status === 'offline';
  return (
    <p
      role="status"
      className={`social-hint ${neutral ? '' : status === 'ok' ? 'social-ok' : 'social-error'}`}
    >
      {status === 'checking' ? (
        <span className="social-spinner" />
      ) : (
        !neutral && <SocialIcon size={16} name={status === 'ok' ? 'check' : 'error'} />
      )}
      {t(`social.handle.${status}`)}
    </p>
  );
}

function Field({
  field,
  value,
  onChange,
  disabled,
  labeled = false,
}: {
  field: ProfileField;
  value: string;
  onChange(value: string): void;
  disabled?: boolean;
  labeled?: boolean;
}) {
  return (
    <label className="social-field">
      {labeled && <span>{t(`social.${field}`)}</span>}
      <span className="social-input">
        {field === 'handle' && <span aria-hidden="true">@</span>}
        {field === 'bio' ? (
          <textarea
            rows={2}
            aria-label={t('social.bio')}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        ) : (
          <input
            autoComplete="off"
            spellCheck={field !== 'handle'}
            aria-label={t(`social.${field}`)}
            value={value}
            onChange={(e) =>
              onChange(field === 'handle' ? e.target.value.toLowerCase() : e.target.value)
            }
            disabled={disabled}
          />
        )}
      </span>
    </label>
  );
}

/** SOC-03: 계정 이메일을 사용하지 않고 입력 중인 공개 프로필만 미리 보여준다. */
export function ProfileSetup({ client, userId }: { client: NodiiClient; userId: string }) {
  const [nickname, setNickname] = useState('');
  const [handle, setHandle] = useState('');
  const [failure, setFailure] = useState<ReturnType<typeof socialErrorCode>>();
  const create = useCreateSocialProfile(client, userId);
  const name = validateNickname(nickname);
  const status = useHandleAvailability(client, handle);
  const moderation = useProfileTextCheck(client, name.value, true, name.valid);
  const hint =
    failure === 'taken'
      ? 'taken'
      : failure === 'handle_held' || failure === 'reserved'
        ? 'unavailable'
        : status;
  const valid =
    name.valid &&
    hint === 'ok' &&
    moderation !== 'banned' &&
    moderation !== 'reserved' &&
    failure !== 'banned' &&
    !create.isPending;
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    try {
      await create.mutateAsync({ nickname: name.value, handle });
    } catch (error) {
      const code = socialErrorCode(error);
      setFailure(code);
      if (code === 'network' || code === 'unknown') toast.error(t('social.save.failed'));
    }
  }
  return (
    <form className="social-setup" onSubmit={(event) => void submit(event)}>
      <h1>{t('social.setup.title')}</h1>
      <p className="supporting">{t('social.setup.description')}</p>
      <div className="social-setup-preview">
        <Avatar size={64} label={name.value || t('social.nickname')} />
        <div>
          <strong className={!name.value ? 'social-muted' : ''}>
            {name.value || t('social.nickname')}
          </strong>
          <div className="social-handle">
            {t('social.handle.display', { handle: handle || t('social.handle') })}
          </div>
        </div>
      </div>
      <Field
        field="nickname"
        value={nickname}
        labeled
        disabled={create.isPending}
        onChange={(value) => {
          setNickname(value);
          setFailure(undefined);
        }}
      />
      <p className="social-hint">{t('social.count.remaining', { count: 20 - name.count })}</p>
      {(moderation === 'banned' || failure === 'banned') && (
        <p role="status" className="social-error">
          {t('social.text.banned')}
        </p>
      )}
      {moderation === 'reserved' && (
        <p role="status" className="social-error">
          {t('social.handle.unavailable')}
        </p>
      )}
      <Field
        field="handle"
        value={handle}
        labeled
        disabled={create.isPending}
        onChange={(value) => {
          setHandle(value);
          setFailure(undefined);
        }}
      />
      <HandleHint status={hint} />
      <Button type="submit" disabled={!valid}>
        {t('social.setup.start')}
      </Button>
    </form>
  );
}

/** SOC-01·02·07: 완료를 누르면 현재 항목 하나만 저장한다. */
export function ProfileFieldEditor({
  client,
  profile,
  field,
  onClose,
  back,
}: {
  client: NodiiClient;
  profile: SocialProfile;
  field: ProfileField;
  onClose(): void;
  back: ReactNode;
}) {
  const [original] = useState(() => profile[field]);
  const [raw, setRaw] = useState(original);
  const [failure, setFailure] = useState<ReturnType<typeof socialErrorCode>>();
  const change = useUpdateSocialProfile(client, profile.userId);
  const locked = field === 'handle' ? cooldownDays(profile) : 0;
  const validation = field === 'bio' ? validateBio(raw) : validateNickname(raw);
  const parsed = validateHandle(raw);
  const status = useHandleAvailability(
    client,
    raw,
    field === 'handle' && !locked && original !== raw,
  );
  const moderation = useProfileTextCheck(
    client,
    validation.value,
    field === 'nickname',
    field !== 'handle' && validation.valid && original !== validation.value,
  );
  const value = field === 'handle' ? parsed.value : validation.value;
  const valid =
    value !== original &&
    !locked &&
    !change.isPending &&
    !failure &&
    (field === 'handle'
      ? status === 'ok'
      : validation.valid && moderation !== 'banned' && moderation !== 'reserved');
  async function save() {
    if (!valid) return;
    try {
      await change.mutateAsync({ [field]: value });
      onClose();
    } catch (error) {
      const code = socialErrorCode(error);
      if (code === 'unknown' || code === 'network') toast.error(t('social.save.failed'));
      else setFailure(code);
    }
  }
  return (
    <>
      {back}
      <form
        className="social-detail-form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        onKeyDown={(e) => {
          if (field === 'bio' && e.key === 'Enter' && e.metaKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void save();
          }
        }}
      >
        <h1>{t(`social.${field}`)}</h1>
        <Field
          field={field}
          value={raw}
          onChange={(value) => {
            setRaw(value);
            setFailure(undefined);
          }}
          disabled={!!locked || change.isPending}
        />
        {field === 'handle' ? (
          <>
            {locked || failure === 'handle_cooldown' ? (
              <p role="status" className="social-hint">
                {t('social.handle.cooldown', { days: locked || 30 })}
              </p>
            ) : (
              <HandleHint
                status={
                  failure === 'taken'
                    ? 'taken'
                    : failure === 'handle_held' || failure === 'reserved' || failure === 'banned'
                      ? 'unavailable'
                      : status
                }
              />
            )}
            <p className="social-note">{t('social.handle.changeHelp', { handle: original })}</p>
          </>
        ) : (
          <div className="social-form-hints">
            {field === 'bio' && <span>{t('social.bio.limit')}</span>}
            <span>
              {t('social.count.remaining', {
                count: (field === 'bio' ? 80 : 20) - validation.count,
              })}
            </span>
          </div>
        )}
        {field !== 'handle' && (failure === 'banned' || moderation === 'banned') && (
          <p role="alert" className="social-error">
            {t('social.text.banned')}
          </p>
        )}
        {field !== 'handle' && (failure === 'reserved' || moderation === 'reserved') && (
          <p role="alert" className="social-error">
            {t('social.handle.unavailable')}
          </p>
        )}
        <div className="social-actions">
          <Button type="button" variant="outline" onClick={onClose} disabled={change.isPending}>
            {t('mobile.add.cancel')}
          </Button>
          <Button type="submit" disabled={!valid}>
            {t('social.done')}
          </Button>
        </div>
      </form>
    </>
  );
}
