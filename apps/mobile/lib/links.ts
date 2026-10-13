// SET-07: 환경별 주소를 우선하되 비어 있으면 실제 공개된 Nodii 페이지를 사용한다.
export const mobileLinks = [
  {
    label: 'settings.privacy',
    url: process.env.EXPO_PUBLIC_PRIVACY_URL?.trim() || 'https://nodii.app/privacy.html',
  },
  {
    label: 'settings.terms',
    url: process.env.EXPO_PUBLIC_TERMS_URL?.trim() || 'https://nodii.app/terms.html',
  },
  {
    label: 'settings.support',
    url: process.env.EXPO_PUBLIC_SUPPORT_URL?.trim() || 'https://nodii.app/support.html',
  },
] as const;
