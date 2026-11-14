import { useState } from 'react';
import {
  avatarUrl,
  relationshipErrorKey,
  useTodayPeople,
  useUpdateTodayPerson,
  type NodiiClient,
  type TodayPerson,
} from '@nodii/api';
import { moveTodayPerson, orderTodayPeople, type SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { SortableList } from '../../components/ui/sortable-list';
import { Avatar } from './ProfileHeader';

export function TodayPeople({
  client,
  me,
  own,
  onBack,
  onFind,
}: {
  client: NodiiClient;
  me: string;
  own?: SocialProfile;
  onBack(): void;
  onFind(): void;
}) {
  const [search, setSearch] = useState('');
  const query = useTodayPeople(client, me);
  const write = useUpdateTodayPerson(client, me, (error) =>
    toast.error(t(relationshipErrorKey(error))),
  );
  const { shown, hidden } = orderTodayPeople(query.data ?? []);
  const term = search.trim().replace(/^@/, '').toLowerCase();
  const matches = ({ profile }: TodayPerson) =>
    profile.nickname.toLowerCase().includes(term) || profile.handle.includes(term);
  const visible = shown.filter(matches);
  const hiddenResults = hidden.filter(matches);
  const move = (id: string, index: number) => {
    if (write.isPending) return;
    const key = moveTodayPerson(
      shown,
      shown.findIndex((p) => p.followeeId === id),
      index,
    );
    if (key) write.mutate({ followeeId: id, patch: { todaySortKey: key } });
  };
  const row = (person: TodayPerson) => (
    <div className="today-person-row">
      <Avatar
        label={person.profile.nickname}
        size={40}
        photoUrl={
          person.profile.avatarPath ? avatarUrl(client, person.profile.avatarPath, 160) : undefined
        }
      />
      <div>
        <strong>{person.profile.nickname}</strong>
        <span className="supporting">
          {t('social.handle.display', { handle: person.profile.handle })}
        </span>
      </div>
      <button
        type="button"
        className="today-person-switch"
        role="switch"
        aria-checked={person.showOnToday}
        aria-label={t('social.today.showPerson', { name: person.profile.nickname })}
        disabled={write.isPending}
        onClick={() => write.toggle(person)}
      >
        <span className="social-switch" data-on={person.showOnToday} />
      </button>
    </div>
  );
  return (
    <section className="today-people-page">
      <Button variant="ghost" className="social-back" onClick={onBack}>
        ‹ {t('tabs.today')}
      </Button>
      <h1>{t('social.today.manage')}</h1>
      <Input
        type="search"
        value={search}
        aria-label={t('social.today.search')}
        placeholder={t('social.today.search')}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className="today-person-row">
        <Avatar
          label={t('social.today.me')}
          size={40}
          photoUrl={own?.avatarPath ? avatarUrl(client, own.avatarPath, 160) : undefined}
        />
        <div>
          <strong>{t('social.today.me')}</strong>
          <span className="supporting">{t('social.today.alwaysFirst')}</span>
        </div>
      </div>
      {query.isError ? (
        <>
          <p role="alert">{t('social.today.peopleFailed')}</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            {t('common.tryAgain')}
          </Button>
        </>
      ) : query.isPending ? (
        <p role="status">{t('mobile.preparing')}</p>
      ) : !query.data?.length ? (
        <>
          <p>{t('social.lists.followingEmpty')}</p>
          <Button onClick={onFind}>{t('social.find')}</Button>
        </>
      ) : (
        <>
          <SortableList
            items={visible.map((p) => ({ id: p.followeeId, label: p.profile.nickname }))}
            disabled={write.isPending}
            handle={<span aria-hidden="true">≡</span>}
            onMove={(id, over) =>
              move(
                id,
                shown.findIndex((p) => p.followeeId === over),
              )
            }
            onNudge={(id, direction) =>
              move(id, shown.findIndex((p) => p.followeeId === id) + direction)
            }
          >
            {({ id }) => row(visible.find((p) => p.followeeId === id)!)}
          </SortableList>
          {hiddenResults.length > 0 && (
            <section>
              <h2 className="supporting">{t('social.today.hidden', { count: hidden.length })}</h2>
              {hiddenResults.map((p) => (
                <div key={p.followeeId}>{row(p)}</div>
              ))}
            </section>
          )}
          {!visible.length && !hiddenResults.length && (
            <p className="supporting">{t('social.today.noMatches')}</p>
          )}
        </>
      )}
    </section>
  );
}
