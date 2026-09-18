import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

/** 오류·비활성·포커스 상태를 로그인 입력 전체에 공통 적용한다. */
export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('input', className)} {...props} />;
}
