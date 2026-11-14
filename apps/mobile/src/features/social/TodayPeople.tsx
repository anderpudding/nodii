import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
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
import { metrics as m, useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { ToastPortal, useToast } from '../../components/Toast';
import { droppedRowIndex } from '../../components/gestures/swipe';
import { Avatar, ProfileNav, profileStyles as s } from './Primitives';
import { ProfileSwitch } from './ProfilePrivacy';

function Handle({
  name,
  pending,
  onDrag,
  onMove,
  onActive,
}: {
  name: string;
  pending: boolean;
  onDrag(distance: number): void;
  onMove(direction: -1 | 1): void;
  onActive(value: boolean): void;
}) {
  const { colors } = useTheme();
  const [distance, setDistance] = useState(0);
  const pan = PanResponder.create({
    onStartShouldSetPanResponder: () => !pending,
    onPanResponderGrant: () => onActive(true),
    onPanResponderMove: (_, gesture) => setDistance(gesture.dy),
    onPanResponderTerminationRequest: () => false,
    onPanResponderRelease: (_, gesture) => {
      onActive(false);
      setDistance(0);
      onDrag(gesture.dy);
    },
    onPanResponderTerminate: () => {
      onActive(false);
      setDistance(0);
    },
  });
  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityState={{ disabled: pending }}
      accessibilityLabel={t('common.sort.label', { name })}
      accessibilityActions={[
        { name: 'increment', label: t('social.today.moveUp') },
        { name: 'decrement', label: t('social.today.moveDown') },
      ]}
      onAccessibilityAction={(event) => {
        if (!pending) onMove(event.nativeEvent.actionName === 'increment' ? -1 : 1);
      }}
      {...pan.panHandlers}
      style={{
        width: m.height.touch,
        height: m.height.touch,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
        borderRadius: m.radius.pill,
        zIndex: distance ? 1 : 0,
        transform: [{ translateY: distance }],
      }}
    >
      <Text style={{ fontSize: 20, color: colors.ink2 }}>≡</Text>
    </View>
  );
}

/** SOC-36: 드래그와 VoiceOver가 같은 표시 순서를 바꾼다. */
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
  const { colors } = useTheme();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [dragging, setDragging] = useState(false);
  const heights = useRef<Record<string, number>>({});
  const query = useTodayPeople(client, me);
  const write = useUpdateTodayPerson(client, me, (error) =>
    toast(() => t(relationshipErrorKey(error))),
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
  const row = (person: TodayPerson, index: number) => {
    const { profile } = person;
    return (
      <View
        key={person.followeeId}
        style={[s.row, { minHeight: 64 }]}
        onLayout={(event) => {
          heights.current[person.followeeId] = event.nativeEvent.layout.height;
        }}
      >
        <Avatar
          label={profile.nickname}
          size={40}
          photoUrl={profile.avatarPath ? avatarUrl(client, profile.avatarPath, 160) : undefined}
        />
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={[s.label, { color: colors.ink, fontSize: m.type.body }]}>
            {profile.nickname}
          </Text>
          <Text numberOfLines={1} style={[s.support, { color: colors.muted }]}>
            {t('social.handle.display', { handle: profile.handle })}
          </Text>
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel={t('social.today.showPerson', { name: profile.nickname })}
          accessibilityState={{ checked: person.showOnToday, disabled: write.isPending }}
          disabled={write.isPending}
          onPress={() => write.toggle(person)}
          style={{
            minHeight: m.height.touch,
            minWidth: m.height.touch,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <ProfileSwitch checked={person.showOnToday} />
        </Pressable>
        {person.showOnToday && (
          <Handle
            name={profile.nickname}
            pending={write.isPending}
            onActive={setDragging}
            onMove={(delta) =>
              move(
                person.followeeId,
                shown.findIndex((p) => p.followeeId === person.followeeId) + delta,
              )
            }
            onDrag={(distance) => {
              const next = droppedRowIndex(
                visible.map((p) => heights.current[p.followeeId] ?? 64),
                index,
                distance,
              );
              if (next === index) return;
              move(
                person.followeeId,
                shown.findIndex((p) => p.followeeId === visible[next]?.followeeId),
              );
            }}
          />
        )}
      </View>
    );
  };
  return (
    <>
      <ProfileNav back={`‹ ${t('tabs.today')}`} title={t('social.today.manage')} onBack={onBack} />
      <ScrollView
        scrollEnabled={!dragging}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[s.page, { gap: m.space.sm }]}
      >
        <TextInput
          accessibilityLabel={t('social.today.search')}
          placeholder={t('social.today.search')}
          placeholderTextColor={colors.muted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            s.body,
            {
              minHeight: m.height.touch,
              backgroundColor: colors.chip,
              borderRadius: m.radius.field,
              color: colors.ink,
              paddingHorizontal: m.space.md,
            },
          ]}
        />
        <View style={[s.row, { minHeight: 64 }]}>
          <Avatar
            label={t('social.today.me')}
            size={40}
            photoUrl={own?.avatarPath ? avatarUrl(client, own.avatarPath, 160) : undefined}
          />
          <View>
            <Text style={[s.label, { color: colors.ink, fontSize: m.type.body }]}>
              {t('social.today.me')}
            </Text>
            <Text style={[s.support, { color: colors.muted }]}>
              {t('social.today.alwaysFirst')}
            </Text>
          </View>
        </View>
        {query.isError ? (
          <>
            <Text accessibilityRole="alert" style={{ color: colors.ink }}>
              {t('social.today.peopleFailed')}
            </Text>
            <Button secondary label={t('common.tryAgain')} onPress={() => void query.refetch()} />
          </>
        ) : query.isPending ? (
          <ActivityIndicator color={colors.ink} />
        ) : !query.data?.length ? (
          <>
            <Text style={{ color: colors.muted }}>{t('social.lists.followingEmpty')}</Text>
            <Button label={t('social.find')} onPress={onFind} />
          </>
        ) : (
          <>
            {visible.map(row)}
            {!!hiddenResults.length && (
              <Text
                accessibilityRole="header"
                style={[s.support, { color: colors.muted, paddingTop: m.space.lg }]}
              >
                {t('social.today.hidden', { count: hidden.length })}
              </Text>
            )}
            {hiddenResults.map(row)}
            {!visible.length && !hiddenResults.length && (
              <Text style={{ color: colors.muted }}>{t('social.today.noMatches')}</Text>
            )}
          </>
        )}
      </ScrollView>
      <ToastPortal />
    </>
  );
}
