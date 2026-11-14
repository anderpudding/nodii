import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
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
import type { FollowRelation, SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { SwipeableRow, SwipeRows } from '../../components/gestures/SwipeableRow';
import { useToast } from '../../components/Toast';
import { RoutineOption } from '../routines/RoutineOption';
import { Avatar, ProfileNav, profileStyles as s } from './Primitives';
import { confirmRelationship, FollowButton, SmallAction } from './RelationshipActions';

type Person = Pick<SocialProfile, 'userId' | 'nickname' | 'handle' | 'avatarPath'>;
type PeopleProps = {
  client: NodiiClient;
  me: string;
  onPerson(userId: string): void;
  onBack(): void;
};

function PersonLabel({
  client,
  person,
  size,
}: {
  client: NodiiClient;
  person: Person;
  size: number;
}) {
  const { colors } = useTheme();
  return (
    <>
      <Avatar
        size={size}
        label={person.nickname}
        photoUrl={person.avatarPath ? avatarUrl(client, person.avatarPath, 160) : undefined}
      />
      <View style={s.fill}>
        <Text numberOfLines={1} style={[s.label, { color: colors.ink }]}>
          {person.nickname}
        </Text>
        <Text numberOfLines={1} style={[s.support, { color: colors.muted }]}>
          {t('social.handle.display', { handle: person.handle })}
        </Text>
      </View>
    </>
  );
}

function PersonRow({
  client,
  me,
  onPerson,
  person,
  size,
  relation,
  removable,
}: Omit<PeopleProps, 'onBack'> & {
  person: Person;
  size: number;
  relation?: FollowRelation;
  removable?: boolean;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [menu, setMenu] = useState(false);
  const mutation = useRemoveFollower(client, me, person.userId);
  const pending = useRelationshipPending(me, person.userId);
  const removeLabel = t('social.lists.removeFollower');
  const confirm = () =>
    confirmRelationship(
      t('social.lists.removeConfirm', { nickname: person.nickname }),
      t('social.lists.removeExplanation'),
      t('social.lists.remove'),
      () => {
        mutation.mutate(undefined, {
          onError: (error) => toast(() => t(relationshipErrorKey(error))),
        });
      },
      true,
    );
  const row = (
    <View style={[s.row, { minHeight: m.height.menu }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={person.nickname}
        onPress={() => onPerson(person.userId)}
        accessibilityActions={removable ? [{ name: 'remove', label: removeLabel }] : undefined}
        onAccessibilityAction={
          removable
            ? ({ nativeEvent }) => {
                if (nativeEvent.actionName === 'remove') confirm();
              }
            : undefined
        }
        style={({ pressed }) => [
          s.row,
          s.fill,
          { minHeight: m.height.touch, opacity: pressed ? m.pressedOpacity : 1 },
        ]}
      >
        <PersonLabel client={client} person={person} size={size} />
      </Pressable>
      <FollowButton client={client} me={me} person={person} relation={relation} />
    </View>
  );
  if (!removable) return row;
  return (
    <>
      <SwipeableRow
        id={person.userId}
        disabled={pending}
        trailing={[
          {
            id: 'remove',
            label: removeLabel,
            visualLabel: t('social.lists.remove'),
            background: colors.dangerFill,
            color: '#FFFFFF',
            run: confirm,
          },
        ]}
        onMenu={() => setMenu(true)}
      >
        {row}
      </SwipeableRow>
      {menu && (
        <BottomSheet
          testID="follower-menu"
          title={person.nickname}
          onClose={() => setMenu(false)}
          bottomCancel
        >
          <RoutineOption
            danger
            label={removeLabel}
            onPress={() => {
              setMenu(false);
              confirm();
            }}
          />
        </BottomSheet>
      )}
    </>
  );
}

function Retry({ retry }: { retry(): void }) {
  const { colors } = useTheme();
  return (
    <View style={s.center}>
      <Text accessibilityRole="alert" style={[s.support, { color: colors.muted }]}>
        {t('social.profile.loadFailed')}
      </Text>
      <Button secondary label={t('common.tryAgain')} onPress={retry} />
    </View>
  );
}

/** SOC-08: 검색어가 준비될 때까지 안내만 표시한다. */
export function ProfileSearch({
  text,
  setText,
  onBack,
  ...props
}: PeopleProps & { text: string; setText(text: string): void }) {
  const { colors } = useTheme();
  const result = useProfileSearch(props.client, props.me, text);
  const [focused, setFocused] = useState(false);
  const people = result.data ?? [];
  const relations = useRelations(
    props.client,
    props.me,
    people.map((person) => person.userId),
  );
  return (
    <>
      <View style={[s.row, { paddingHorizontal: m.space.lg }]}>
        <TextInput
          accessibilityLabel={t('social.search.placeholder')}
          autoFocus
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[
            s.body,
            s.fill,
            {
              backgroundColor: colors.chip,
              color: colors.ink,
              height: m.height.touch,
              borderWidth: m.todayRing,
              borderColor: focused ? colors.ink : colors.chip,
              borderRadius: m.radius.field,
              paddingHorizontal: m.space.md,
            },
          ]}
          placeholder={t('social.search.placeholder')}
          placeholderTextColor={colors.muted}
          value={text}
          onChangeText={setText}
        />
        <Button quiet label={t('mobile.add.cancel')} onPress={onBack} />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.page, { paddingVertical: m.space.md, gap: m.space.sm }]}
      >
        <Text style={[s.support, { color: colors.muted }]}>{t('social.search.hint')}</Text>
        {!result.online || result.fetchStatus === 'paused' ? (
          <Text style={[s.support, { color: colors.muted }]}>{t('social.search.offline')}</Text>
        ) : result.ready && result.isError ? (
          <Retry retry={() => void result.refetch()} />
        ) : result.data && !people.length ? (
          <Text style={[s.support, { color: colors.muted }]}>{t('social.search.empty')}</Text>
        ) : (
          people.map((person) => (
            <PersonRow
              key={person.userId}
              {...props}
              person={person}
              size={44}
              relation={relations.data?.get(person.userId)}
            />
          ))
        )}
        {relations.isError && <Retry retry={() => void relations.refetch()} />}
      </ScrollView>
    </>
  );
}

/** SOC-12: 같은 목록 줄에 내보내기 밀기와 길게 누르기를 연결한다. */
export function FollowListPage({
  kind,
  select,
  counts,
  onFind,
  onInvite,
  onBack,
  ...props
}: PeopleProps & {
  kind: FollowList;
  select(kind: FollowList): void;
  counts?: Record<FollowList, number>;
  onFind(): void;
  onInvite(): void;
}) {
  const { colors } = useTheme();
  const following = useFollowing(props.client, props.me, kind === 'following');
  const followers = useFollowers(props.client, props.me, kind === 'followers');
  const result = kind === 'following' ? following : followers;
  const people = result.data?.people ?? [];
  const relations = useRelations(
    props.client,
    props.me,
    people.map((person) => person.userId),
  );
  return (
    <>
      <ProfileNav back={`‹ ${t('tabs.profile')}`} onBack={onBack} />
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('tabs.profile')}
        style={[
          s.row,
          {
            alignSelf: 'center',
            backgroundColor: colors.chip,
            borderRadius: m.radius.pill,
            paddingHorizontal: m.space.xs,
          },
        ]}
      >
        {followLists.map((name) => (
          <RoutineOption
            key={name}
            segment
            selected={name === kind}
            label={t('social.lists.count', {
              label: t(`social.${name}`),
              count: counts?.[name] ?? '–',
            })}
            onPress={() => select(name)}
          />
        ))}
      </View>
      {result.isError ? (
        <Retry retry={() => void result.refetch()} />
      ) : !result.data ? (
        <ActivityIndicator color={colors.ink} />
      ) : !people.length ? (
        <View style={s.center}>
          <Text style={[s.support, { color: colors.muted }]}>
            {t(
              kind === 'following' ? 'social.lists.followingEmpty' : 'social.lists.followersEmpty',
            )}
          </Text>
          <Button
            pill
            secondary
            label={t(kind === 'following' ? 'social.find' : 'social.invite.send')}
            onPress={kind === 'following' ? onFind : onInvite}
          />
        </View>
      ) : (
        <SwipeRows>
          <ScrollView contentContainerStyle={[s.page, { paddingVertical: m.space.md }]}>
            {people.map((person) => (
              <PersonRow
                key={person.userId}
                {...props}
                person={person}
                size={40}
                relation={relations.data?.get(person.userId)}
                removable={kind === 'followers'}
              />
            ))}
            {relations.isError && <Retry retry={() => void relations.refetch()} />}
            {result.data.truncated && (
              <Text style={[s.support, { color: colors.muted }]}>
                {t('social.lists.truncated')}
              </Text>
            )}
          </ScrollView>
        </SwipeRows>
      )}
    </>
  );
}

function BlockedRow({ client, me, person }: { client: NodiiClient; me: string; person: Person }) {
  const { colors } = useTheme();
  const toast = useToast();
  const mutation = useUnblock(client, me, person.userId);
  const pending = useRelationshipPending(me, person.userId);
  return (
    <View
      style={[
        s.row,
        {
          minHeight: m.height.menu,
          paddingHorizontal: m.space.md,
          borderBottomWidth: m.border,
          borderBottomColor: colors.bg,
        },
      ]}
    >
      <PersonLabel client={client} person={person} size={40} />
      <SmallAction
        label={t('social.block.unblock')}
        secondary
        disabled={pending}
        onPress={() => {
          confirmRelationship(
            t('social.block.unblockConfirm', { nickname: person.nickname }),
            t('social.block.unblockExplanation'),
            t('social.block.unblock'),
            () => {
              mutation.mutate(undefined, {
                onError: (error) => toast(() => t(relationshipErrorKey(error))),
              });
            },
          );
        }}
      />
    </View>
  );
}

/** SOC-61: 설정의 인셋 그룹에서 내가 차단한 사람만 해제한다. */
export function BlockedProfiles({
  client,
  me,
  onBack,
}: {
  client: NodiiClient;
  me: string;
  onBack(): void;
}) {
  const { colors } = useTheme();
  const result = useBlockedProfiles(client, me);
  return (
    <>
      <ProfileNav back={`‹ ${t('settings.title')}`} onBack={onBack} />
      <ScrollView contentContainerStyle={[s.page, { gap: m.space.md, paddingBottom: m.space.lg }]}>
        <Text accessibilityRole="header" style={[s.title, { color: colors.ink }]}>
          {t('social.block.title')}
        </Text>
        {result.isError ? (
          <Retry retry={() => void result.refetch()} />
        ) : !result.data ? (
          <ActivityIndicator color={colors.ink} />
        ) : result.data.length ? (
          <View style={[s.card, { backgroundColor: colors.chip }]}>
            {result.data.map((person) => (
              <BlockedRow key={person.userId} client={client} me={me} person={person} />
            ))}
          </View>
        ) : (
          <Text style={[s.support, { color: colors.muted }]}>{t('social.block.empty')}</Text>
        )}
      </ScrollView>
    </>
  );
}
