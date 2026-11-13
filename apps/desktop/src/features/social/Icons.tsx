import { socialIcons } from '@nodii/core';

/** D13: 소셜 화면도 기존과 같은 선 굵기를 사용한다. */
export function SocialIcon({ name, size = 22 }: { name: keyof typeof socialIcons; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={socialIcons[name]} />
    </svg>
  );
}
