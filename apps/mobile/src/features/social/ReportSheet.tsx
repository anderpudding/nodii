import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import {
  relationshipErrorKey,
  useReportProfile,
  useReportTodo,
  type NodiiClient,
} from '@nodii/api';
import {
  REPORT_DETAIL_LIMIT,
  REPORT_REASONS,
  validateReportDetail,
  type ReportReason,
} from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { RoutineOption } from '../routines/RoutineOption';
import { profileStyles as s } from './Primitives';
import { ProfileSwitch } from './ProfilePrivacy';

export function ReportSheet({
  client,
  me,
  person,
  todo,
  onClose,
  onBlocked,
}: {
  client: NodiiClient;
  me: string;
  person: { userId: string; nickname: string };
  todo?: { id: string; title: string };
  onClose(): void;
  onBlocked(): void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [reason, setReason] = useState<ReportReason>();
  const [detail, setDetail] = useState('');
  const [alsoBlock, setAlsoBlock] = useState(false);
  const profileReport = useReportProfile(client, me);
  const todoReport = useReportTodo(client, me);
  const report = todo ? todoReport : profileReport;
  const heading = todo
    ? t('social.report.todoTitle')
    : t('social.report.title', { nickname: person.nickname });
  const parsed = validateReportDetail(detail, reason ?? 'other');
  const valid = reason && (reason !== 'other' || parsed.valid);
  async function submit() {
    if (!valid || !reason || report.isPending) return;
    try {
      const input = {
        targetUserId: person.userId,
        reason,
        detail: reason === 'other' ? parsed.value : undefined,
        alsoBlock,
      };
      const { blocked, blockFailed } = todo
        ? await todoReport.mutateAsync({ ...input, todoId: todo.id })
        : await profileReport.mutateAsync(input);
      toast(() => t(blockFailed ? 'social.report.blockFailed' : 'social.report.sent'));
      onClose();
      if (blocked) onBlocked();
    } catch (error) {
      toast(() => t(relationshipErrorKey(error)));
    }
  }
  return (
    <BottomSheet
      testID={todo ? 'report-todo' : 'report-profile'}
      title={heading}
      keyboard
      onClose={() => {
        if (!report.isPending) onClose();
      }}
    >
      {todo && (
        <Text numberOfLines={1} style={[s.support, { color: colors.muted }]}>
          {todo.title}
        </Text>
      )}
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={heading}
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
