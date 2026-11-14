import { avatarUrl, type NodiiClient, type TodayPerson } from '@nodii/api';
import type { SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { Avatar } from './ProfileHeader';

/** SOC-30·35: 내 얼굴부터 목록 버튼까지 전체 줄을 함께 스크롤한다. */
export function AvatarRow({
  client,
  me,
  people,
  selected,
  onSelect,
  onManage,
}: {
  client: NodiiClient;
  me?: SocialProfile;
  people: readonly TodayPerson[];
  selected: string | null;
  onSelect(id: string | null): void;
  onManage(): void;
}) {
  const profiles = [
    { id: null, name: t('social.today.me'), avatar: me?.avatarPath },
    ...people.map(({ profile }) => ({
      id: profile.userId,
      name: profile.nickname,
      avatar: profile.avatarPath,
    })),
  ];
  return (
    <div className="today-avatar-row">
      {profiles.map(({ id, name, avatar }) => {
        const viewing = id === selected;
        const label =
          id === null
            ? t(viewing ? 'social.today.mineSelected' : 'social.today.mine')
            : t(viewing ? 'social.today.personSelected' : 'social.today.person', { name });
        return (
          <button
            key={id ?? 'me'}
            type="button"
            aria-label={label}
            aria-pressed={viewing}
            onClick={() => onSelect(id)}
          >
            <Avatar
              label={name}
              size={46}
              selected={viewing}
              photoUrl={avatar ? avatarUrl(client, avatar, 160) : undefined}
            />
            <span className="today-avatar-name">{name}</span>
          </button>
        );
      })}
      <button type="button" onClick={onManage}>
        <span className="today-avatar-list" aria-hidden="true">
          ≡
        </span>
        <span>{t('social.today.list')}</span>
      </button>
    </div>
  );
}
