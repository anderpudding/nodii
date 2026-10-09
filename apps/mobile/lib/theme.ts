import { useColorScheme } from 'react-native';

export const lightColors = {
  bg: '#FFFFFF',
  side: '#F7F8FA',
  surface: '#FFFFFF',
  ink: '#16181D',
  ink2: '#4B5160',
  muted: '#646A76',
  line: '#E9EBEF',
  line2: '#DADDE2',
  field: '#8F95A0',
  boxFill: '#F1F2F5',
  stamp: '#ECEEF1',
  stampEmpty: '#F4F5F7',
  banner: '#F2F4F7',
  focus: '#2A63C9',
  danger: '#C4332C',
  sun: '#C4332C',
  sat: '#2A63C9',
  warnBg: '#FFF4DB',
  warnInk: '#8A5A00',
  scrim: 'rgba(22,24,29,0.32)',
};
export const darkColors: typeof lightColors = {
  bg: '#131417',
  side: '#1A1C20',
  surface: '#1D1F23',
  ink: '#F1F2F4',
  ink2: '#B4B9C2',
  muted: '#9AA0AA',
  line: '#26292E',
  line2: '#353941',
  field: '#70757F',
  boxFill: '#1E2024',
  stamp: '#2A2D33',
  stampEmpty: '#212429',
  banner: '#1F2227',
  focus: '#7AA7FF',
  danger: '#FF7A70',
  sun: '#FF7A70',
  sat: '#7AA7FF',
  warnBg: '#3A2F17',
  warnInk: '#F2C66D',
  scrim: 'rgba(0,0,0,0.5)',
};
export type Colors = typeof lightColors;
// tokens.md의 공통 값 + mobile-screens.md §1/MobileLogin의 모바일 값.
export const metrics = {
  fontFamily: 'Pretendard-Regular',
  fontMedium: 'Pretendard-Medium',
  fontSemiBold: 'Pretendard-SemiBold',
  fontBold: 'Pretendard-Bold',
  space: { xs: 4, sm: 8, md: 12, lg: 16, group: 26, page: 48 },
  radius: { field: 12, button: 14, card: 14, mark: 7 },
  height: { touch: 44, field: 52 },
  focusRing: 3,
  border: 1,
  pressedOpacity: 0.55,
  type: { title: 28, heading: 20, body: 16, button: 14, supporting: 13, label: 12 },
  letterSpacing: { title: -0.7, button: -0.1 },
  lineHeight: { body: 1.5, title: 1.25 },
  motion: { state: 150, press: 120, check: 280, menu: 140, toast: 240 },
};
/** SET-02: M1은 기기 시스템 테마만 따른다. */
export function useTheme() {
  const isDark = useColorScheme() === 'dark';
  return { isDark, colors: isDark ? darkColors : lightColors };
}
