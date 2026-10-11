import { useEffect, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { todayISO } from '@nodii/core';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../lib/theme';
import { Button } from '../components/Button';

function deviceToday() {
  return todayISO(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', new Date());
}
/** M1: 실제 하루 목록을 붙이기 전 날짜 제목과 로그아웃 자리만 제공한다. */
export function Today({ onLogout, loggingOut }: { onLogout(): void; loggingOut: boolean }) {
  const { colors } = useTheme();
  const [today, setToday] = useState(deviceToday);
  useEffect(() => {
    const update = () => setToday(deviceToday());
    const timer = setInterval(update, 1000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  const date = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${today}T00:00:00Z`));
  return (
    <View style={styles.content}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.ink }]}>
        {date}
      </Text>
      <Text style={[styles.description, { color: colors.muted }]}>
        {t('mobile.today.preparing')}
      </Text>
      <Button
        label={t('auth.logout')}
        secondary
        busy={loggingOut}
        disabled={loggingOut}
        onPress={onLogout}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { flex: 1, padding: m.space.group, gap: m.space.lg },
  title: {
    fontFamily: m.fontBold,
    fontSize: m.type.title,
    fontWeight: '700',
    letterSpacing: m.letterSpacing.title,
  },
  description: {
    flex: 1,
    fontFamily: m.fontFamily,
    fontSize: m.type.body,
    lineHeight: m.type.body * m.lineHeight.body,
  },
});
