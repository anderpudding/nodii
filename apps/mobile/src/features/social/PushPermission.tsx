import { useEffect, useState } from 'react';
import { AppState, Linking, Platform, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { t } from '@nodii/i18n';
import type { NodiiClient } from '@nodii/api';
import { metrics as m, useTheme } from '../../../lib/theme';
import { syncPushToken } from '../../../lib/push';
import { Button } from '../../components/Button';
import { useToast } from '../../components/Toast';
import { ProfileTool, profileStyles as s } from './Primitives';

const key = 'nodii:push-permission-dismissal';
const week = 7 * 24 * 60 * 60 * 1000;

function useDevicePermission() {
  const [status, setStatus] = useState<Notifications.NotificationPermissionsStatus>();
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let live = true;
    const refresh = () => {
      void Notifications.getPermissionsAsync()
        .then((value) => {
          if (live) setStatus(value);
        })
        .catch(() => {});
    };
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return [status, setStatus] as const;
}

/** SOC-54: 사용자가 카드를 눌렀을 때만 iOS 권한을 요청한다. */
export function PushPermissionCard({ client, me }: { client: NodiiClient; me: string }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [permission, setPermission] = useDevicePermission();
  const [dismissal, setDismissal] = useState<string | null>();
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let live = true;
    void AsyncStorage.getItem(key)
      .then((value) => {
        if (live) setDismissal(value);
      })
      .catch(() => {});
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  if (
    permission?.status !== 'undetermined' ||
    dismissal === undefined ||
    dismissal === 'done' ||
    (dismissal !== null && now - Number(dismissal) < week)
  )
    return null;

  const fail = () => toast(() => t('social.push.failed'));
  async function enable() {
    setBusy(true);
    try {
      const result = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowSound: true, allowBadge: false },
      });
      setPermission(result);
      if (result.granted) await syncPushToken(client, me, () => true);
    } catch {
      fail();
    } finally {
      setBusy(false);
    }
  }
  return (
    <View
      style={{
        backgroundColor: colors.chip,
        borderRadius: m.radius.card,
        gap: m.space.sm,
        padding: m.space.lg,
        alignItems: 'center',
      }}
    >
      <View style={{ alignSelf: 'flex-end' }}>
        <ProfileTool
          label={t('social.notifications.dismiss')}
          onPress={() => {
            const value = dismissal === null ? String(Date.now()) : 'done';
            setDismissal(value);
            void AsyncStorage.setItem(key, value).catch(fail);
          }}
        >
          <Text style={[s.heading, { color: colors.ink }]}>×</Text>
        </ProfileTool>
      </View>
      <Text style={[s.heading, { color: colors.ink, textAlign: 'center' }]}>
        {t('social.push.prompt')}
      </Text>
      <Button
        pill
        label={t('social.push.enable')}
        busy={busy}
        disabled={busy}
        onPress={() => void enable()}
      />
    </View>
  );
}

/** SOC-53: 서버 설정과 별도로 기기에서 알림이 차단된 경우만 표시한다. */
export function PushDeviceSettings() {
  const { colors } = useTheme();
  const toast = useToast();
  const [permission] = useDevicePermission();
  if (permission?.status !== 'denied') return null;
  return (
    <View style={{ padding: m.space.md, gap: m.space.xs }}>
      <Text style={[s.support, { color: colors.muted }]}>{t('social.push.disabled')}</Text>
      <Button
        quiet
        label={t('social.push.settings')}
        onPress={() => {
          void Linking.openSettings().catch(() => toast(() => t('social.push.failed')));
        }}
      />
    </View>
  );
}
