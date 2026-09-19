import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

const focusable =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), [href], [tabindex="0"]';

/** macOS 12 초기 WebView에서도 모달 포커스·복원·Esc를 지원한다. */
export function Sheet({
  children,
  labelledBy,
  onClose,
  role = 'dialog',
  className = '',
  describedBy,
}: {
  children: ReactNode;
  labelledBy: string;
  onClose: () => void;
  role?: 'dialog' | 'alertdialog';
  className?: string;
  describedBy?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const dialog = ref.current!;
    (
      dialog.querySelector<HTMLElement>('[data-initial-focus]') ??
      dialog.querySelector<HTMLElement>(focusable)
    )?.focus();
    const targets = () => [
      ...dialog.querySelectorAll<HTMLElement>(focusable),
      ...document.querySelectorAll<HTMLElement>('[data-sonner-toast] button'),
    ];
    const focus = (event: FocusEvent) => {
      if (
        event.target instanceof Element &&
        !dialog.contains(event.target) &&
        !event.target.closest('[data-sonner-toaster]')
      )
        targets()[0]?.focus();
    };
    const key = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        close.current();
      }
      if (event.key === 'Tab') {
        const items = targets();
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (
          index === -1 ||
          (!event.shiftKey && index === items.length - 1) ||
          (event.shiftKey && index === 0)
        ) {
          event.preventDefault();
          items[event.shiftKey ? items.length - 1 : 0]?.focus();
        }
      }
    };
    document.addEventListener('focusin', focus);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('focusin', focus);
      document.removeEventListener('keydown', key);
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return createPortal(
    <div
      className="sheet-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        className={`goal-sheet ${className}`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
