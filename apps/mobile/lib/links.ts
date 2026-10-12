// SET-07: 배포 주소가 없으면 준비 중으로 표시하고 임의 주소로 보내지 않는다.
export const mobileLinks = [
  { label: 'settings.privacy', url: process.env.EXPO_PUBLIC_PRIVACY_URL ?? '' },
  { label: 'settings.terms', url: process.env.EXPO_PUBLIC_TERMS_URL ?? '' },
  { label: 'settings.support', url: process.env.EXPO_PUBLIC_SUPPORT_URL ?? '' },
] as const;
