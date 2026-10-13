import { Component, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { t } from '@nodii/i18n';
import { metrics as m, useTheme } from '../../lib/theme';
import { Button } from '../components/Button';

function Recovery({ onRetry }: { onRetry(): void }) {
  const { colors } = useTheme();
  return (
    <ScrollView style={{ backgroundColor: colors.bg }} contentContainerStyle={styles.center}>
      <Text accessibilityRole="alert" style={[styles.title, { color: colors.ink }]}>
        {t('mobile.error.title')}
      </Text>
      <Button label={t('common.tryAgain')} onPress={onRetry} />
    </ScrollView>
  );
}

/** M6: 화면 예외는 개인정보를 로그에 남기지 않고 복구 가능한 최상위 안내로 바꾼다. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch() {
    void SplashScreen.hideAsync().catch(() => {
      // 렌더 복구는 유지하며 네이티브 오류 내용(개인정보 포함 가능)은 출력하지 않는다.
    });
  }
  override render() {
    return this.state.failed ? (
      <Recovery onRetry={() => this.setState({ failed: false })} />
    ) : (
      this.props.children
    );
  }
}
const styles = StyleSheet.create({
  center: { flexGrow: 1, padding: m.space.page, justifyContent: 'center', gap: m.space.lg },
  // 폰트 로딩 자체가 실패한 경우에도 시스템 글꼴로 읽을 수 있다.
  title: { fontSize: m.type.heading, lineHeight: m.type.heading * m.lineHeight.body },
});
