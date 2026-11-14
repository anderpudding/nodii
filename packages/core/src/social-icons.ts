// 두 플랫폼에서 같은 24 단위 선 아이콘을 사용한다.
export const socialIcons = {
  today:
    'M8 3v4m8-4v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zm3 8 3 3 5-5',
  notifications: 'M4 17h16c-2-2-2-4-2-7a6 6 0 0 0-12 0c0 3 0 5-2 7zm6 3a2 2 0 0 0 4 0',
  profile: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21a8 8 0 0 1 16 0',
  find: 'M13 8a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0zM2 20a7 7 0 0 1 14 0m3-14v8m-4-4h8',
  sliders:
    'M3 7h11m4 0h3M3 17h3m4 0h11m-3-10a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM10 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  lock: 'M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2zm1 0V7a4 4 0 0 1 8 0v4',
  check: 'm5 12 4 4 10-10',
  error: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0zM12 7v6m0 4h.01',
  mutual:
    'M9 4a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm-6 16a6 6 0 0 1 12 0m1-16a3 3 0 1 1 0 6m1 4a5 5 0 0 1 4 6',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3zM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0z',
} as const;
export const socialTabs = ['today', 'notifications', 'profile'] as const;
export type SocialTab = (typeof socialTabs)[number];

export const goalVisibilityPaths = {
  mutual:
    'M5.3 7.8a3.7 3.7 0 1 0 7.4 0 3.7 3.7 0 1 0-7.4 0M2.5 20c.5-4 3.1-6.3 6.5-6.3s6 2.3 6.5 6.3zM13.9 8.6a2.9 2.9 0 1 0 5.8 0 2.9 2.9 0 1 0-5.8 0M16.4 13.8c3 .2 4.8 2.4 5.2 6.2h-4.4c-.1-2.5-.4-4.4-.8-6.2z',
  followers: 'M8 7.8a4 4 0 1 0 8 0 4 4 0 1 0-8 0M4.5 20.5c.6-4.3 3.6-6.8 7.5-6.8s6.9 2.5 7.5 6.8z',
} as const;

/** SOC-40: 양쪽 앱에서 같은 24 단위 하트 윤곽을 쓴다. */
export const HEART_PATH =
  'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z';
