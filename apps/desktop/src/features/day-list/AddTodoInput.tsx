import { useConnectivity } from '../../lib/connectivity';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import { normalizeTitle, TITLE_MAX_LENGTH } from '@nodii/core';

export type AddTodoCloseReason = 'escape' | 'outside';

/**
 * IME 입력을 보존하고 Enter 이후에도 입력 줄을 유지한다 (TODO-01).
 * Esc 또는 입력 줄 바깥 클릭으로 닫으며, 적던 글자는 저장하지 않는다.
 */
export function AddTodoInput({
  goalName,
  onAdd,
  onClose,
}: {
  goalName: string;
  onAdd: (title: string) => void;
  onClose: (reason: AddTodoCloseReason) => void;
}) {
  const online = useConnectivity();
  const [title, setTitle] = useState('');
  const [invalid, setInvalid] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  // 닫힌 뒤(IME 확정 등)에 늦게 오는 이벤트가 저장으로 이어지지 않게 막는다.
  const closed = useRef(false);
  const latestOnClose = useRef(onClose);
  useEffect(() => {
    latestOnClose.current = onClose;
  }, [onClose]);
  useEffect(() => {
    // 휠·트랙패드 스크롤은 pointerdown을 만들지 않으므로 닫히지 않는다.
    const dismiss = (event: PointerEvent) => {
      if (closed.current) return;
      if (event.target instanceof Node && container.current?.contains(event.target)) return;
      closed.current = true;
      latestOnClose.current('outside');
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, []);
  return (
    <div
      className="add-todo"
      ref={container}
      // 안내 문구·빈 체크 자리를 눌러도 입력칸의 포커스를 유지한다.
      onMouseDown={(event) => {
        if (!(event.target instanceof HTMLInputElement)) event.preventDefault();
      }}
    >
      <span className="empty-check" aria-hidden="true" />
      <input
        autoFocus
        aria-label={`${goalName} 새 할 일`}
        aria-invalid={invalid}
        placeholder="할 일을 적어 주세요"
        value={title}
        maxLength={TITLE_MAX_LENGTH}
        onChange={(event) => {
          setTitle(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={(event) => {
          if (closed.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            closed.current = true;
            onClose('escape');
          }
          if (event.key === 'Enter') {
            event.preventDefault();
            if (!online) {
              toast.error('오프라인이라 저장할 수 없어요');
              return;
            }
            const normalized = normalizeTitle(title);
            if (!normalized) {
              setInvalid(true);
              return;
            }
            onAdd(normalized);
            setTitle('');
            setInvalid(false);
          }
        }}
      />
      <span className="input-hint">
        {invalid ? '할 일을 1~200자로 적어 주세요' : 'Enter로 추가, Esc로 닫기'}
      </span>
    </div>
  );
}
