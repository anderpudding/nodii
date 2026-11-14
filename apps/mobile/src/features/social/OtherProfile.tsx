import { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  relationshipErrorKey,
  useBlock,
  useRelations,
  useRelationshipPending,
  useReportProfile,
  useSocialProfile,
  type NodiiClient,
} from '@nodii/api';
import {
  REPORT_DETAIL_LIMIT,
  REPORT_REASONS,
  validateReportDetail,
  type ReportReason,
  type SocialProfile,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { RoutineOption } from '../routines/RoutineOption';
import { Avatar, ProfileNav, ProfileTool, profileStyles as s } from './Primitives';
import { ProfileHeader } from './ProfileHeader';
import { confirmRelationship, FollowButton } from './RelationshipActions';
import { ProfileSwitch } from './ProfilePrivacy';

function ReportSheet({
  client,
  me,
  person,
  onClose,
  onBlocked,
}: {
  client: NodiiClient;
  me: string;
  person: SocialProfile;
  onClose(): void;
  onBlocked(): void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>();
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const report = useReportProfile(client, me);
  const parsed = validateReportDetail(detail, reason ?? 'other');
  const valid = reason && (reason !== 'other' || parsed.valid);
  async function submit() {
    if (!valid || !reason || report.isPending) return;
    try {
      const { blocked, blockFailed } = await report.mutateAsync({
        targetUserId: person.userId,
        reason,
        detail: reason === 'other' ? parsed.value : undefined,
        alsoBlock,
      });
      toast(() => t(blockFailed ? 'social.report.blockFailed' : 'social.report.sent'));
      onClose();
      if (blocked) onBlocked();
    } catch (error) {
      toast(() => t(relationshipErrorKey(error)));
    }
  }
  return (
    <BottomSheet
      testID="report-profile"
      title={t('social.report.title', { nickname: person.nickname })}
      keyboard
      onClose={() => {
        if (!report.isPending) onClose();
      }}
    >
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={t('social.report.title', { nickname: person.nickname })}
        style={[s.card, { backgroundColor: colors.chip }]}
      >
        {REPORT_REASONS.map((value) => (
          <RoutineOption
            key={value}
            compact
            selected={reason === value}
            disabled={report.isPending}
            label={t(`social.report.${value}`)}
            onPress={() => setReason(value)}
          />
        ))}
      </View>
      {reason === 'other' && (
        <>
          <TextInput
            accessibilityLabel={t('social.report.detail')}
            placeholder={t('social.report.detail')}
            placeholderTextColor={colors.muted}
            multiline
            value={detail}
            editable={!report.isPending}
            onChangeText={(next) => setDetail([...next].slice(0, REPORT_DETAIL_LIMIT).join(''))}
            style={[
              s.body,
              {
                minHeight: m.height.menu,
                padding: m.space.md,
                borderRadius: m.radius.field,
                backgroundColor: colors.chip,
                color: colors.ink,
              },
            ]}
          />
          <Text style={[s.support, { color: colors.muted }]}>
            {t('social.report.remaining', { count: REPORT_DETAIL_LIMIT - [...detail].length })}
          </Text>
        </>
      )}
      <Pressable
        accessibilityRole="switch"
        accessibilityLabel={t('social.report.alsoBlock')}
        accessibilityState={{ checked: alsoBlock, disabled: report.isPending }}
        disabled={report.isPending}
        onPress={() => setAlsoBlock(!alsoBlock)}
        style={[s.row, { minHeight: m.height.touch, justifyContent: 'space-between' }]}
      >
        <Text style={[s.body, { color: colors.ink }]}>{t('social.report.alsoBlock')}</Text>
        <ProfileSwitch checked={alsoBlock} />
      </Pressable>
      <Text style={[s.support, { color: colors.muted }]}>{t('social.report.hint')}</Text>
      <Button
        pill
        label={t('social.report.action')}
        onPress={() => void submit()}
        disabled={!valid || report.isPending}
        busy={report.isPending}
      />
    </BottomSheet>
  );
}

/** SOC-38·60·62: 프로필 헤더와 관계 동작을 한 화면에 둔다. */
export function OtherProfile({
  client,
  me,
  userId,
  from,
  onBack,
  onBlocked,
}: {
  client: NodiiClient;
  me: string;
  userId: string;
  from: string;
  onBack(): void;
  onBlocked(): void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const query = useSocialProfile(client, userId);
  const person = query.data;
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
        <ScrollView contentContainerStyle={[s.page, { alignItems: 'center', gap: m.space.sm }]}>
          <ProfileHeader client={client} profile={person} />
          <FollowButton
            client={client}
            me={me}
            person={person}
            relation={relations.data?.get(userId)}
            size={36}
          />
          {relations.isError && (
            <Button
              secondary
              label={t('common.tryAgain')}
              onPress={() => void relations.refetch()}
            />
          )}
        </ScrollView>
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
