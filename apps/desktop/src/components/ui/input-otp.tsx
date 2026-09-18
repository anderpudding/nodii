import { useContext, type ComponentProps } from 'react';
import { OTPInput, OTPInputContext } from 'input-otp';
import { cn } from '../../lib/utils';

/** 단일 접근성 입력을 여섯 칸으로 보여주어 붙여넣기·자동완성을 유지한다. */
export function InputOTP({
  className,
  containerClassName,
  disabled,
  ...props
}: ComponentProps<typeof OTPInput>) {
  return (
    <OTPInput
      containerClassName={cn(
        'otp-container',
        disabled && 'otp-container-disabled',
        containerClassName,
      )}
      className={className}
      disabled={disabled}
      {...props}
    />
  );
}

/** 코드는 스크린리더에 중복으로 읽히지 않게 시각 슬롯만 제공한다. */
export function InputOTPSlot({ index }: { index: number }) {
  const context = useContext(OTPInputContext);
  const slot = context.slots[index];
  return (
    <div aria-hidden="true" className={cn('otp-slot', slot?.isActive && 'otp-slot-active')}>
      {slot?.char ?? (slot?.hasFakeCaret ? '│' : '')}
    </div>
  );
}
