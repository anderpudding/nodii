import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { useQueryClient } from '@tanstack/react-query';
import { syncProfileTimezone, type NodiiClient, type Session } from '@nodii/api';
import { t } from '@nodii/i18n';
import { bindAuthRefresh } from '../../lib/auth-lifecycle';
import { appStoreUrl, checkMobileVersion, type UpdateInfo } from '../../lib/version-gate';
import { logout } from '../../lib/logout';
import { metrics as m, useTheme } from '../../lib/theme';
import { mobileClient, mobileEnv } from '../../lib/supabase';
import { useToast } from '../components/Toast';
import { Button } from '../components/Button';
import { Login } from '../features/auth/Login';
import { Today } from '../features/Today';

type Gate =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'update'; info: UpdateInfo }
  | { status: 'ready'; session: Session | null };

/** SET-05・AUTH-02: 버전 → 저장 세션 → 화면 순서로 진입하고 준비 동안 스플래시를 유지한다. */
export function AppGate({ client = mobileClient }: { client?: NodiiClient | null }) {
  const [gate, setGate] = useState<Gate>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const logoutBusy = useRef(false);
  const refresh = useRef<ReturnType<typeof bindAuthRefresh> | null>(null);
  const query = useQueryClient();
  const toast = useToast();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (!client) return;
    const lifecycle = bindAuthRefresh(client, AppState, () =>
      toast(t('mobile.session.refreshFailed')),
    );
    refresh.current = lifecycle;
    return () => {
      lifecycle.dispose();
      refresh.current = null;
    };
  }, [client, toast]);

  useEffect(() => {
    if (!client) return;
    let live = true;
    let unsubscribe: (() => void) | undefined;
    let eventReceived = false;
    let previousUser: string | undefined;
    function applySession(session: Session | null) {
      if (!live) return;
      if (previousUser && previousUser !== session?.user.id) query.clear();
      previousUser = session?.user.id;
      refresh.current?.setSignedIn(!!session);
      setGate({ status: 'ready', session });
    }
    async function restore() {
      const info = await checkMobileVersion(client!, Constants.expoConfig?.version ?? '0.1.0');
      if (!live) return;
      if (info) {
        setGate({ status: 'update', info });
        return;
      }
      const {
        data: { subscription },
      } = client!.auth.onAuthStateChange((event, session) => {
        // SDK 잠금 안에서 다른 인증 메서드를 await하지 않는다.
        if (event === 'INITIAL_SESSION' || logoutBusy.current) return;
        eventReceived = true;
        applySession(session);
      });
      unsubscribe = () => subscription.unsubscribe();
      try {
        const { data, error } = await client!.auth.getSession();
        if (!live || eventReceived) return;
        if (error) setGate({ status: 'error' });
        else applySession(data.session);
      } catch {
        if (live && !eventReceived) setGate({ status: 'error' });
      }
    }
    void restore();
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, [client, query, attempt]);

  const userId = gate.status === 'ready' ? gate.session?.user.id : undefined;
  useEffect(() => {
    if (!client || !userId) return;
    const controller = new AbortController();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    void syncProfileTimezone(client, userId, timezone, controller.signal).catch(() => {
      if (!controller.signal.aborted) toast(t('mobile.profile.failed'));
    });
    return () => controller.abort();
  }, [client, userId, toast]);

  const ready = !client || gate.status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => toast(t('mobile.session.failed')));
  }, [ready, toast]);

  async function signOut() {
    if (!client || logoutBusy.current) return;
    logoutBusy.current = true;
    setLoggingOut(true);
    await refresh.current?.pause();
    try {
      const result = await logout(client, query);
      setGate({ status: 'ready', session: null });
      if (result.localOnly) toast(t('auth.logout.local'));
    } catch {
      refresh.current?.setSignedIn(true);
      toast(t('auth.logout.failed'));
    } finally {
      logoutBusy.current = false;
      setLoggingOut(false);
    }
  }
  async function openStore() {
    const url = appStoreUrl(mobileEnv.appStoreId);
    if (!url) {
      toast(t('mobile.update.missing'));
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      toast(t('mobile.update.failed'));
    }
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {!client ? (
        <View style={styles.center}>
          <Text style={{ color: colors.ink }}>{t('mobile.config.missing')}</Text>
        </View>
      ) : gate.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.ink} />
          <Text accessibilityRole="text" style={{ color: colors.muted }}>
            {t('mobile.preparing')}
          </Text>
        </View>
      ) : gate.status === 'error' ? (
        <View style={styles.center}>
          <Text accessibilityRole="alert" style={[styles.description, { color: colors.ink }]}>
            {t('mobile.session.failed')}
          </Text>
          <Button
            label={t('common.tryAgain')}
            onPress={() => {
              setGate({ status: 'loading' });
              setAttempt((value) => value + 1);
            }}
          />
        </View>
      ) : gate.status === 'update' ? (
        <View style={styles.center}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
            {t('mobile.update.title')}
          </Text>
          <Text style={[styles.description, { color: colors.ink2 }]}>
            {t('mobile.update.description')}
          </Text>
          <Text style={[styles.description, { color: colors.muted }]}>
            {t('mobile.update.versions', {
              current: gate.info.current,
              minimum: gate.info.minimum,
            })}
          </Text>
          <Button label={t('mobile.update.action')} onPress={() => void openStore()} />
        </View>
      ) : gate.session ? (
        <Today key={gate.session.user.id} onLogout={() => void signOut()} loggingOut={loggingOut} />
      ) : (
        <Login client={client} reviewAccountEmail={mobileEnv.reviewAccountEmail} />
      )}
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, padding: m.space.group, justifyContent: 'center', gap: m.space.lg },
  title: {
    fontFamily: m.fontBold,
    fontSize: m.type.title,
    fontWeight: '700',
    letterSpacing: m.letterSpacing.title,
  },
  description: {
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
  },
});
