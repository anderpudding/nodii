import { useOnline } from '../../../lib/connectivity';
import { useRef, useState } from 'react';
import { Text } from 'react-native';
import {
  useEndRoutine,
  useDeleteRoutine,
  useRoutineWritePending,
  type NodiiClient,
  type RoutineRecord,
} from '@nodii/api';
import type { ISODate } from '@nodii/core';
import { t } from '@nodii/i18n';
import { useTheme } from '../../../lib/theme';
import { BottomSheet } from '../../components/BottomSheet';
import { useToast } from '../../components/Toast';
import { RoutineOption } from './RoutineOption';
import { routineStyles as s } from './styles';

/** ROUT-09: 종료·전체 삭제 결과를 먼저 설명하고 기존 훅으로 한 번만 쓴다. */
export function RoutineStop({
  client,
  routine,
  today,
  onClose,
}: {
  client: NodiiClient;
  routine: RoutineRecord;
  today: ISODate;
  onClose(): void;
}) {
  const { colors } = useTheme();
  const online = useOnline();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const guard = useRef(false);
  const options = { onError: () => toast(() => t('todo.save.failed')) };
  const end = useEndRoutine(client, routine.id, options);
  const remove = useDeleteRoutine(client, routine.id, options);
  const pending = useRoutineWritePending(routine.id);
  const busy = saving || pending;
  async function save(action: 'end' | 'delete') {
    if (!online || guard.current || busy) return;
    guard.current = true;
    setSaving(true);
    try {
      if (action === 'end') await end.mutateAsync({ routine, today });
      else await remove.mutateAsync({ routine });
      onClose();
    } catch {
      /* 훅의 롤백·토스트 후 같은 선택을 다시 시도할 수 있다. */
    } finally {
      guard.current = false;
      setSaving(false);
    }
  }
  return (
    <BottomSheet
      title={t('routine.stop')}
      testID="routine-stop-sheet"
      bottomCancel
      onClose={() => {
        if (!guard.current && !busy) onClose();
      }}
    >
      {!online && (
        <Text style={[s.supporting, { color: colors.muted }]}>{t('sync.writeDisabled')}</Text>
      )}
      <Text style={[s.label, { color: colors.ink }]}>{routine.title}</Text>
      <RoutineOption
        label={t('routine.endToday')}
        description={t('routine.endDescription')}
        disabled={!online || busy}
        onPress={() => void save('end')}
      />
      <RoutineOption
        label={t('routine.delete')}
        description={t('routine.deleteDescription')}
        danger
        disabled={!online || busy}
        onPress={() => void save('delete')}
      />
      <Text style={[s.supporting, { color: colors.danger }]}>{t('routine.deleteWarning')}</Text>
    </BottomSheet>
  );
}
