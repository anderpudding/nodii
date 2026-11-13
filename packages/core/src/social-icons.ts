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
