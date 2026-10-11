import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { t } from '@nodii/i18n';
import regular from '../assets/fonts/Pretendard-Regular.otf';
import medium from '../assets/fonts/Pretendard-Medium.otf';
import semiBold from '../assets/fonts/Pretendard-SemiBold.otf';
import bold from '../assets/fonts/Pretendard-Bold.otf';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { metrics as m, useTheme } from '../lib/theme';
import { ToastProvider } from '../src/components/Toast';

// AUTH-02: 세션 복원이 끝나기 전에 네이티브 스플래시가 사라지지 않게 한다.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // 이미 숨겨진 개발 스플래시는 게이트의 준비 화면으로 대체된다.
});
const queryClient = new QueryClient();

export default function RootLayout() {
  const { colors } = useTheme();
  const [fontsLoaded, fontError] = useFonts({
    'Pretendard-Regular': regular,
    'Pretendard-Medium': medium,
    'Pretendard-SemiBold': semiBold,
    'Pretendard-Bold': bold,
  });
  useEffect(() => {
    if (fontError) void SplashScreen.hideAsync();
  }, [fontError]);
  if (fontError)
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: m.space.group,
          backgroundColor: colors.bg,
        }}
      >
        <Text style={{ color: colors.ink }}>{t('mobile.font.failed')}</Text>
      </View>
    );
  if (!fontsLoaded) return null; // 네이티브 스플래시가 계속 표시된다.

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ToastProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ToastProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
