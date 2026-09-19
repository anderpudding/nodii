import { useConnectivity } from '../../lib/connectivity';
import { toast } from 'sonner';
import { useState } from 'react';
import { normalizeTitle, TITLE_MAX_LENGTH } from '@nodii/core';

/** IME 입력을 보존하고 Enter 이후에도 입력 줄을 유지한다 (TODO-01). */
export function AddTodoInput({
  goalName,
  onAdd,
  onClose,
}: {
  goalName: string;
  onAdd: (title: string) => void;
  onClose: () => void;
}) {
  const online = useConnectivity();
  const [title, setTitle] = useState('');
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="add-todo">
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
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
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
