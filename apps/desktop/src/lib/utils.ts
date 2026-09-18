import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** shadcn 프리미티브의 기본 스타일과 화면별 클래스를 합친다. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
