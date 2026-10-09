import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@nodii/i18n';
import { runCoreSpike, runNetworkSpike, runStorageSpike } from '../src/spike';

type CheckState =
  | { status: 'checking'; detail: string }
  | { status: 'success'; detail: string }
  | { status: 'failure'; detail: string }
  | { status: 'missing'; detail: string };

const lightColors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  side: '#F7F8FA',
  ink: '#16181D',
  ink2: '#4B5160',
  muted: '#646A76',
  line: '#E9EBEF',
  focus: '#2A63C9',
  danger: '#C4332C',
};

const darkColors = {
  bg: '#131417',
  surface: '#1D1F23',
  side: '#1A1C20',
  ink: '#F1F2F4',
  ink2: '#B4B9C2',
  muted: '#9AA0AA',
  line: '#26292E',
  focus: '#7AA7FF',
  danger: '#FF7A70',
};

function initialCheck(): CheckState {
  return { status: 'checking', detail: t('mobile.spike.status.checking') };
}

function formatPreviousRun(value: string | null): string {
  if (!value) return t('mobile.spike.previous.none');
  const formatted = new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
  return t('mobile.spike.previous.value', { value: formatted });
}

export default function SpikeScreen() {
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [network, setNetwork] = useState<CheckState>(initialCheck);
  const [storage, setStorage] = useState<CheckState>(initialCheck);
  const [previousRun, setPreviousRun] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const core = useMemo(() => runCoreSpike(timeZone, new Date()), [timeZone]);

  const check = useCallback(async () => {
    setIsChecking(true);
    setNetwork(initialCheck());
    setStorage(initialCheck());

    const [networkResult, storageResult] = await Promise.allSettled([
      runNetworkSpike(),
      runStorageSpike(new Date()),
    ]);

    if (networkResult.status === 'rejected') {
      setNetwork({ status: 'failure', detail: t('mobile.spike.network.failed', { status: '—' }) });
    } else if (!networkResult.value.configured) {
      setNetwork({ status: 'missing', detail: t('mobile.spike.network.missingEnv') });
    } else if (networkResult.value.health?.ok) {
      setNetwork({ status: 'success', detail: t('mobile.spike.status.success') });
    } else {
      setNetwork({
        status: 'failure',
        detail: t('mobile.spike.network.failed', {
          status: networkResult.value.health?.status ?? '—',
        }),
      });
    }

    if (storageResult.status === 'fulfilled') {
      setPreviousRun(storageResult.value.previousRunAt);
      setStorage({ status: 'success', detail: t('mobile.spike.storage.success') });
    } else {
      setStorage({ status: 'failure', detail: t('mobile.spike.storage.failed') });
    }

    setIsChecking(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void check(), 0);
    return () => clearTimeout(timer);
  }, [check]);

  const statusColor = (state: CheckState) => {
    if (state.status === 'success') return colors.focus;
    if (state.status === 'failure') return colors.danger;
    return colors.muted;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'right', 'bottom', 'left']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>{t('mobile.spike.eyebrow')}</Text>
          <Text style={styles.title}>{t('mobile.spike.title')}</Text>
          <Text style={styles.description}>{t('mobile.spike.description')}</Text>
        </View>

        <View style={styles.card}>
          <CheckRow
            label={t('mobile.spike.network.label')}
            state={network}
            color={statusColor(network)}
            styles={styles}
          />
          <View style={styles.divider} />
          <CheckRow
            label={t('mobile.spike.storage.label')}
            state={storage}
            color={statusColor(storage)}
            styles={styles}
          />
        </View>

        <View style={styles.meta}>
          <Text style={styles.metaText}>{formatPreviousRun(previousRun)}</Text>
          <Text style={styles.metaText}>
            {t('mobile.spike.core', {
              date: core.date,
              occurs: t(core.occurs ? 'mobile.spike.core.occurs' : 'mobile.spike.core.notOccurs'),
            })}
          </Text>
          <Text style={styles.metaText}>
            {t('mobile.spike.version', { version: Constants.expoConfig?.version ?? '—' })}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          disabled={isChecking}
          onPress={() => void check()}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          {isChecking ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.buttonText}>{t('common.retry')}</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

interface CheckRowProps {
  label: string;
  state: CheckState;
  color: string;
  styles: ReturnType<typeof createStyles>;
}

function CheckRow({ label, state, color, styles }: CheckRowProps) {
  return (
    <View style={styles.row} accessibilityLabel={`${label}. ${state.detail}`}>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDetail}>{state.detail}</Text>
      </View>
      <Text style={[styles.status, { color }]}>{state.status === 'success' ? '✓' : '—'}</Text>
    </View>
  );
}

type Colors = typeof lightColors;

function createStyles(colors: Colors) {
  return StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.bg },
    content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 44, paddingBottom: 24 },
    header: { marginBottom: 32 },
    eyebrow: { color: colors.muted, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
    title: {
      color: colors.ink,
      fontSize: 28,
      fontWeight: '700',
      letterSpacing: -0.7,
      marginTop: 8,
    },
    description: { color: colors.ink2, fontSize: 16, lineHeight: 24, marginTop: 10 },
    card: {
      backgroundColor: colors.surface,
      borderColor: colors.line,
      borderRadius: 14,
      borderWidth: StyleSheet.hairlineWidth,
      overflow: 'hidden',
    },
    row: {
      minHeight: 76,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
    },
    rowCopy: { flex: 1, paddingRight: 12 },
    rowLabel: { color: colors.ink, fontSize: 16, fontWeight: '700' },
    rowDetail: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
      marginTop: 4,
    },
    status: {
      width: 44,
      minHeight: 44,
      textAlign: 'center',
      textAlignVertical: 'center',
      fontSize: 20,
      fontWeight: '700',
    },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginLeft: 16 },
    meta: { backgroundColor: colors.side, borderRadius: 12, padding: 16, marginTop: 16, gap: 6 },
    metaText: {
      color: colors.ink2,
      fontSize: 13,
      fontWeight: '500',
      lineHeight: 20,
      fontVariant: ['tabular-nums'],
    },
    button: {
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 52,
      borderRadius: 14,
      backgroundColor: colors.ink,
      marginTop: 'auto',
      paddingHorizontal: 16,
    },
    buttonPressed: { opacity: 0.55 },
    buttonText: { color: colors.bg, fontSize: 14, fontWeight: '700' },
  });
}
