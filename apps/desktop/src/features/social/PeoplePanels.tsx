import { useState, type ReactNode } from 'react';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  avatarUrl,
  followLists,
  relationshipErrorKey,
  useBlockedProfiles,
  useFollowers,
  useFollowing,
  useProfileSearch,
  useRelations,
  useRelationshipPending,
  useRemoveFollower,
  useUnblock,
  type FollowList,
  type NodiiClient,
} from '@nodii/api';
import type { SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { toast } from 'sonner';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Avatar } from './ProfileHeader';
import { FollowButton, RelationshipConfirm } from './RelationshipActions';

type Person = Pick<SocialProfile, 'userId' | 'nickname' | 'handle' | 'avatarPath'>;
type PeopleProps = { client: NodiiClient; me: string; onPerson(userId: string): void };

function PersonLabel({
  client,
  person,
  size,
}: {
  client: NodiiClient;
  person: Person;
  size: number;
}) {
  return (
    <>
      <Avatar
        size={size}
        label={person.nickname}
        photoUrl={person.avatarPath ? avatarUrl(client, person.avatarPath, 160) : undefined}
      />
      <span className="social-person-label">
        <strong>{person.nickname}</strong>
        <span className="social-handle">
          {t('social.handle.display', { handle: person.handle })}
        </span>
      </span>
    </>
  );
}

function RowActions({
  me,
  person,
  children,
  client,
}: {
  me: string;
  person: Person;
  children: ReactNode;
  client: NodiiClient;
}) {
  const [confirm, setConfirm] = useState(false);
  const mutation = useRemoveFollower(client, me, person.userId);
  const pending = useRelationshipPending(me, person.userId);
  const label = t('social.lists.removeFollower');
  return (
    <>
      <ContextMenu.Root>
        <ContextMenu.Trigger asChild disabled={pending}>
          <div className="social-person-row">
            {children}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <Button
                  variant="ghost"
                  className="social-tool social-row-menu"
                  aria-label={label}
                  disabled={pending}
                >
                  ⋯
                </Button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content className="todo-menu" align="end">
                  <DropdownMenu.Item
                    className="todo-menu-item social-danger-text"
                    onSelect={() => setConfirm(true)}
                  >
                    {label}
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </ContextMenu.Trigger>
        <ContextMenu.Portal>
          <ContextMenu.Content className="todo-menu">
            <ContextMenu.Item
              className="todo-menu-item social-danger-text"
              onSelect={() => setConfirm(true)}
            >
              {label}
            </ContextMenu.Item>
          </ContextMenu.Content>
        </ContextMenu.Portal>
      </ContextMenu.Root>
      {confirm && (
        <RelationshipConfirm
          title={t('social.lists.removeConfirm', { nickname: person.nickname })}
          description={t('social.lists.removeExplanation')}
          action={t('social.lists.remove')}
          danger
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            mutation.mutate(undefined, {
              onError: (error) => toast.error(t(relationshipErrorKey(error))),
            });
          }}
        />
      )}
    </>
  );
}

function PeopleRows({
  client,
  me,
  onPerson,
  people,
  size,
  removable,
}: PeopleProps & { people: Person[]; size: number; removable?: boolean }) {
  const relations = useRelations(
    client,
    me,
    people.map((person) => person.userId),
  );
  return (
    <>
      <div className="social-people">
        {people.map((person) => {
          const content = (
            <>
              <button className="social-person-link" onClick={() => onPerson(person.userId)}>
                <PersonLabel client={client} person={person} size={size} />
              </button>
              <FollowButton
                client={client}
                me={me}
                person={person}
                relation={relations.data?.get(person.userId)}
              />
            </>
          );
          return removable ? (
            <RowActions key={person.userId} client={client} me={me} person={person}>
              {content}
            </RowActions>
          ) : (
            <div key={person.userId} className="social-person-row">
              {content}
            </div>
          );
        })}
      </div>
      {relations.isError && <Retry retry={() => void relations.refetch()} />}
    </>
  );
}

function Retry({ retry }: { retry(): void }) {
  return (
    <div className="social-list-message">
      <p role="alert">{t('social.profile.loadFailed')}</p>
      <Button variant="outline" onClick={retry}>
        {t('common.tryAgain')}
      </Button>
    </div>
  );
}

/** SOC-06·08: 검색을 유지해 상대 프로필에서 돌아와 같은 결과를 볼 수 있다. */
export function ProfileSearch({
  text,
  setText,
  ...props
}: PeopleProps & { text: string; setText(text: string): void }) {
  const result = useProfileSearch(props.client, props.me, text);
  return (
    <section className="social-people-panel">
      <h1>{t('social.find')}</h1>
      <Input
        type="search"
        autoFocus
        autoComplete="off"
        aria-label={t('social.search.placeholder')}
        placeholder={t('social.search.placeholder')}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="supporting">{t('social.search.hint')}</p>
      {!result.online || result.fetchStatus === 'paused' ? (
        <p className="supporting" role="status">
          {t('social.search.offline')}
        </p>
      ) : result.ready && result.isError ? (
        <Retry retry={() => void result.refetch()} />
      ) : result.data?.length ? (
        <PeopleRows {...props} people={result.data} size={44} />
      ) : (
        result.data && (
          <p className="social-list-message" role="status">
            {t('social.search.empty')}
          </p>
        )
      )}
    </section>
  );
}

/** SOC-12: 같은 세그먼트로 두 방향의 목록을 전환한다. */
export function FollowListPanel({
  kind,
  select,
  counts,
  onFind,
  onInvite,
  ...props
}: PeopleProps & {
  kind: FollowList;
  select(kind: FollowList): void;
  counts?: Record<FollowList, number>;
  onFind(): void;
  onInvite(): void;
}) {
  const following = useFollowing(props.client, props.me, kind === 'following');
  const followers = useFollowers(props.client, props.me, kind === 'followers');
  const result = kind === 'following' ? following : followers;
  return (
    <section className="social-people-panel">
      <div className="social-list-heading">
        <h1>{t(`social.${kind}`)}</h1>
        <div className="social-list-segment" role="group" aria-label={t('tabs.profile')}>
          {followLists.map((name) => (
            <Button
              key={name}
              variant={kind === name ? 'default' : 'ghost'}
              aria-pressed={kind === name}
              onClick={() => select(name)}
            >
              {t('social.lists.count', {
                label: t(`social.${name}`),
                count: counts?.[name] ?? '–',
              })}
            </Button>
          ))}
        </div>
      </div>
      {result.isError ? (
        <Retry retry={() => void result.refetch()} />
      ) : result.data?.people.length ? (
        <>
          <PeopleRows
            {...props}
            people={result.data.people}
            size={40}
            removable={kind === 'followers'}
          />
          {result.data.truncated && <p className="supporting">{t('social.lists.truncated')}</p>}
        </>
      ) : result.data ? (
        <div className="social-list-message">
          <p>
            {t(
              kind === 'following' ? 'social.lists.followingEmpty' : 'social.lists.followersEmpty',
            )}
          </p>
          <Button variant="outline" onClick={kind === 'following' ? onFind : onInvite}>
            {t(kind === 'following' ? 'social.find' : 'social.invite.send')}
          </Button>
        </div>
      ) : (
        <p className="social-list-message" role="status">
          {t('mobile.preparing')}
        </p>
      )}
    </section>
  );
}

function BlockedRow({ client, me, person }: { client: NodiiClient; me: string; person: Person }) {
  const [confirm, setConfirm] = useState(false);
  const mutation = useUnblock(client, me, person.userId);
  const pending = useRelationshipPending(me, person.userId);
  return (
    <div className="social-person-row">
      <div className="social-person-link">
        <PersonLabel client={client} person={person} size={40} />
      </div>
      <Button
        variant="outline"
        className="social-small-action"
        disabled={pending}
        onClick={() => setConfirm(true)}
      >
        {t('social.block.unblock')}
      </Button>
      {confirm && (
        <RelationshipConfirm
          title={t('social.block.unblockConfirm', { nickname: person.nickname })}
          description={t('social.block.unblockExplanation')}
          action={t('social.block.unblock')}
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setConfirm(false);
            mutation.mutate(undefined, {
              onError: (error) => toast.error(t(relationshipErrorKey(error))),
            });
          }}
        />
      )}
    </div>
  );
}

/** SOC-61: 차단한 프로필만 표시하고 해당 행에서 해제한다. */
export function BlockedProfiles({ client, me }: { client: NodiiClient; me: string }) {
  const result = useBlockedProfiles(client, me);
  return (
    <section className="social-people-panel">
      <h1>{t('social.block.title')}</h1>
      {result.isError ? (
        <Retry retry={() => void result.refetch()} />
      ) : result.data?.length ? (
        <div className="social-people social-blocked-list">
          {result.data.map((person) => (
            <BlockedRow key={person.userId} client={client} me={me} person={person} />
          ))}
        </div>
      ) : (
        <p className="social-list-message" role="status">
          {t(result.data ? 'social.block.empty' : 'mobile.preparing')}
        </p>
      )}
    </section>
  );
}
