import { useEffect, useState } from 'react';
import { useThemePreference } from './theme-preference';
import { AccessibilityInfo, useColorScheme } from 'react-native';

export const lightColors = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  chip: '#F2F3F6',
  box: '#E6E8EC',
  stampSoft: '#F2F3F6',
  ink: '#111318',
  ink2: '#3E4350',
  muted: '#626877',
  line: '#ECEEF1',
  line2: '#DFE2E7',
  danger: '#D6303A',
  dangerFill: '#D6303A',
  sun: '#D6303A',
  sat: '#2563EB',
  toastAction: '#9DB8FF',
  warnBg: '#FFF4DB',
  warnInk: '#8A5A00',
  scrim: 'rgba(17,19,24,0.36)',
};
export const darkColors: typeof lightColors = {
  bg: '#0F1013',
  surface: '#1A1C21',
  chip: '#1E2026',
  box: '#2B2E35',
  stampSoft: '#1E2026',
  ink: '#F3F4F6',
  ink2: '#B9BEC8',
  muted: '#9097A3',
  line: '#22252B',
  line2: '#30333A',
  danger: '#FF6B6B',
  dangerFill: '#D6303A',
  sun: '#FF7A7A',
  sat: '#7AA7FF',
  toastAction: '#2F5BD8',
  warnBg: '#3A2F17',
  warnInk: '#F2C66D',
  scrim: 'rgba(0,0,0,0.55)',
};
export type Colors = typeof lightColors;
// tokens.md의 공통 값 + mobile-screens.md §1/MobileLogin의 모바일 값.
export const metrics = {
  fontFamily: 'Pretendard-Regular',
  fontMedium: 'Pretendard-Medium',
  fontSemiBold: 'Pretendard-SemiBold',
  fontBold: 'Pretendard-Bold',
  space: { xs: 4, sm: 8, md: 12, lg: 16, group: 16, page: 48 },
  radius: { field: 14, button: 999, card: 18, mark: 999, stamp: 999, sheet: 26, pill: 999 },
  height: { touch: 44, field: 52, chip: 36, menu: 56, calendarCell: 66, weekCell: 78, button: 54 },
  glyph: { check: 26, stamp: 30, icon: 20 },
  handle: { width: 36, height: 5 },
  selectionRing: 2,
  border: 1,
  pressedOpacity: 0.55,
  toastInset: 10, // MobileUndo
  longPressScale: 1.02, // mobile-screens.md MobileGestures 보완값
  type: { title: 30, heading: 20, body: 16, button: 14, supporting: 13, label: 12 },
  letterSpacing: { title: -1, button: -0.2 },
  lineHeight: { body: 1.5, title: 1.25 },
  motion: { state: 150, press: 120, check: 280, menu: 140, toast: 240 },
};
/** SET-02: 저장한 기기 테마 또는 시스템 테마를 모든 화면이 공유한다. */
export function useTheme() {
  const system = useColorScheme();
  const preference = useThemePreference((state) => state.preference);
  const isDark = preference === 'dark' || (preference === 'system' && system === 'dark');
  return { isDark, colors: isDark ? darkColors : lightColors };
}
/** 모션 감소가 켜졌거나 아직 확인 전이면 시트 전환을 애니메이션 없이 표시한다. */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(
      (value) => {
        if (live) setReduced(value);
      },
      () => {
        /* 확인할 수 없으면 애니메이션을 끈 상태를 유지한다. */
      },
    );
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
