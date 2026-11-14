import { ReportSheet } from './ReportSheet';
import { useState } from 'react';
import { ActionSheetIOS, ActivityIndicator, Text, View } from 'react-native';
import {
  relationshipErrorKey,
  useBlock,
  useRelations,
  useRelationshipPending,
  useSocialProfile,
  type NodiiClient,
} from '@nodii/api';
import { monthKeyOf, type Profile, type SocialProfile } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useTheme } from '../../../lib/theme';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { Avatar, ProfileNav, ProfileTool, profileStyles as s } from './Primitives';
import { PersonDayHeader, collapseDistance } from './PersonDayHeader';
import { FriendDay } from './FriendDay';
import { useUIStore } from '../../stores/ui';
import { useReducedMotion } from '../../../lib/theme';
import { confirmRelationship } from './RelationshipActions';

/** SOC-38·60·62: 프로필 헤더와 관계 동작을 한 화면에 둔다. */
export function OtherProfile({
  client,
  me,
  userId,
  from,
  onBack,
  onBlocked,
  calendarProfile,
}: {
  client: NodiiClient;
  me: string;
  userId: string;
  from: string;
  onBack(): void;
  onBlocked(): void;
  calendarProfile?: Profile;
}) {
  const { colors } = useTheme();
  const today = useUIStore((state) => state.today);
  const [date, setDate] = useState(today);
  const [month, setMonth] = useState(() => monthKeyOf(today));
  const [expanded, setExpanded] = useState(false);
  const [scroll, setScroll] = useState(0);
  const reduced = useReducedMotion();
  const progress = reduced
    ? Number(scroll >= collapseDistance / 2)
    : Math.min(1, scroll / collapseDistance);
  const select = (value: string) => {
    setDate(value);
    setMonth(monthKeyOf(value));
  };

  const toast = useToast();
  const query = useSocialProfile(client, userId);
  const person = query.data;
  const expandedHeight = person?.bio ? 236 : 204;
  const collapseOffset = reduced
    ? Math.max(0, expandedHeight - 64 - collapseDistance / 2)
    : Math.max(0, expandedHeight - 64 - collapseDistance);
  const relations = useRelations(client, me, person ? [userId] : []);
  const pending = useRelationshipPending(me, userId);
  const block = useBlock(client, me, userId);
  const [report, setReport] = useState(false);
  function menu(profile: SocialProfile) {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: [t('mobile.add.cancel'), t('social.report.action'), t('social.block.menu')],
        cancelButtonIndex: 0,
        destructiveButtonIndex: 2,
      },
      (index) => {
        if (index === 1) setReport(true);
        if (index === 2)
          confirmRelationship(
            t('social.block.confirm', { nickname: profile.nickname }),
            t('social.block.explanation'),
            t('social.block.action'),
            () => {
              block.mutate(undefined, {
                onSuccess: onBlocked,
                onError: (error) => toast(() => t(relationshipErrorKey(error))),
              });
            },
            true,
          );
      },
    );
  }
  return (
    <>
      <ProfileNav
        back={`‹ ${from}`}
        onBack={onBack}
        trailing={
          person &&
          !query.isError && (
            <ProfileTool
              label={t('social.profile.actions')}
              disabled={pending}
              onPress={() => menu(person)}
            >
              <Text style={[s.heading, { color: colors.ink }]}>⋯</Text>
            </ProfileTool>
          )
        }
      />
      {query.isPending ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.ink} />
        </View>
      ) : query.isError || !person ? (
        <View style={s.center}>
          <Avatar size={84} label={t('tabs.profile')} />
          <Text style={[s.heading, { color: colors.ink }]}>{t('social.profile.gone')}</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <FriendDay
            client={client}
            me={me}
            friendId={userId}
            nickname={person.nickname}
            onBlocked={onBlocked}
            profile={calendarProfile ?? { timezone: 'UTC', weekStart: 0 }}
            today={today}
            date={date}
            onSelect={select}
            month={month}
            onMonth={setMonth}
            monthExpanded={expanded}
            onSetMonthExpanded={(value) => {
              setExpanded(value);
              setMonth(monthKeyOf(date));
            }}
            contentTop={expandedHeight - collapseOffset * progress}
            minScroll={collapseDistance}
            onScroll={(event) => setScroll(Math.max(0, event.nativeEvent.contentOffset.y))}
          />
          <PersonDayHeader
            client={client}
            me={me}
            person={person}
            relation={relations.data?.get(userId)}
            progress={progress}
            expandedHeight={expandedHeight}
          />
          {relations.isError && (
            <Button
              secondary
              label={t('common.tryAgain')}
              onPress={() => void relations.refetch()}
            />
          )}
        </View>
      )}
      {person && report && (
        <ReportSheet
          client={client}
          me={me}
          person={person}
          onClose={() => setReport(false)}
          onBlocked={onBlocked}
        />
      )}
    </>
  );
}
