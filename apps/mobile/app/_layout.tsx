import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useFonts } from 'expo-font';
import { t } from '@nodii/i18n';
import regular from '../assets/fonts/Pretendard-Regular.otf';
import medium from '../assets/fonts/Pretendard-Medium.otf';
import semiBold from '../assets/fonts/Pretendard-SemiBold.otf';
import bold from '../assets/fonts/Pretendard-Bold.otf';
import extraBold from '../assets/fonts/Pretendard-ExtraBold.otf';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useTheme } from '../lib/theme';
import { configurePseudoLocale } from '../lib/pseudo-locale';
import { useLocale } from '../lib/use-locale';
import { restoreLanguage, bindLanguage } from '../lib/language-preference';
import { restoreTheme } from '../lib/theme-preference';
import { bindConnectivity } from '../lib/connectivity';
import { ToastProvider } from '../src/components/Toast';
import { ErrorBoundary } from '../src/shell/ErrorBoundary';
import { STARTUP_TIMEOUT_MS, withStartupTimeout } from '../lib/startup-timeout';

configurePseudoLocale(__DEV__, process.env.EXPO_PUBLIC_PSEUDO_LOCALE);

// AUTH-02: 세션 복원이 끝나기 전에 네이티브 스플래시가 사라지지 않게 한다.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // 이미 숨겨진 개발 스플래시는 게이트의 준비 화면으로 대체된다.
});
const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <RootContent />
    </ErrorBoundary>
  );
}
function RootContent() {
  useLocale();
  const { colors } = useTheme();
  const [themeLoaded, setThemeLoaded] = useState(false);
  const [languageError, setLanguageError] = useState(false);
  const [themeError, setThemeError] = useState(false);
  useEffect(() => {
    void Promise.all([
      withStartupTimeout(restoreTheme()).catch(() => setThemeError(true)),
      restoreLanguage().catch(() => setLanguageError(true)),
    ]).finally(() => setThemeLoaded(true));
  }, []);
  useEffect(() => bindConnectivity(), []);
  useEffect(() => bindLanguage(), []);
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': regular,
    'Pretendard-Medium': medium,
    'Pretendard-SemiBold': semiBold,
    'Pretendard-Bold': bold,
    'Pretendard-ExtraBold': extraBold,
  });
  const [fontTimedOut, setFontTimedOut] = useState(false);
  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setFontTimedOut(true), STARTUP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);
  if (fontError || fontTimedOut) throw new Error('font_load_failed');
  if (!fontsLoaded || !themeLoaded) return null; // 네이티브 스플래시가 계속 표시된다.

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            {themeError && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {t('settings.theme.failed')}
              </Text>
            )}
            {languageError && (
              <Text accessibilityRole="alert" style={{ color: colors.danger }}>
                {t('settings.language.loadFailed')}
              </Text>
            )}
            <Stack screenOptions={{ headerShown: false }} />
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
