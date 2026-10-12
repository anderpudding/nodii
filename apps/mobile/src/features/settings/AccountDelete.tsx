import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { assertOnline, countAccountContents, deleteMyAccount, type NodiiClient } from '@nodii/api';
import { t } from '@nodii/i18n';
import { useOnline } from '../../../lib/connectivity';
import { useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { RoutineOption } from '../routines/RoutineOption';
import { settingsStyles as s } from './styles';

/** AUTH-06: 정확한 삭제 개수와 이해 확인이 준비돼야 되돌릴 수 없는 RPC를 실행한다. */
export function AccountDelete({
  client,
  onClose,
  onDeleted,
}: {
  client: NodiiClient;
  onClose(): void;
  onDeleted(): Promise<void>;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const [understood, setUnderstood] = useState(false);
  const [saving, setSaving] = useState(false);
  const guard = useRef(false);
  const counts = useQuery({
    queryKey: ['accountContents'],
    queryFn: ({ signal }) => countAccountContents(client, signal),
    staleTime: 0,
  });
  async function remove() {
    if (!online || !understood || !counts.data || counts.isError || guard.current) return;
    guard.current = true;
    setSaving(true);
    try {
      assertOnline();
      await deleteMyAccount(client);
      await onDeleted();
    } catch {
      toast(t('settings.delete.failed'));
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  return (
    <BottomSheet
      title={t('settings.delete')}
      testID="account-delete-sheet"
      onClose={() => {
        if (!guard.current) onClose();
      }}
    >
      <View accessibilityRole="alert">
        <Text style={[s.body, { color: colors.ink }]}>{t('settings.delete.description')}</Text>
        <Text style={[s.supporting, { color: colors.ink2 }]}>
          {counts.data ? t('settings.delete.counts', counts.data) : t('goal.counts.loading')}
        </Text>
      </View>
      {counts.isError && (
        <>
          <Text style={{ color: colors.danger }}>{t('goal.counts.failed')}</Text>
          <Button secondary label={t('common.tryAgain')} onPress={() => void counts.refetch()} />
        </>
      )}
      <RoutineOption
        label={t('settings.delete.understood')}
        multiple
        selected={understood}
        disabled={saving}
        onPress={() => setUnderstood(!understood)}
      />
      {!online && (
        <Text style={[s.supporting, { color: colors.muted }]}>{t('sync.writeDisabled')}</Text>
      )}
      <Button
        label={t('settings.delete')}
        disabled={!online || !understood || !counts.data || counts.isError || saving}
        busy={saving}
        onPress={() => void remove()}
      />
    </BottomSheet>
  );
}
