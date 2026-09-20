import { useConnectivity } from '../../lib/connectivity';
import { useEffect, useRef, useState } from 'react';
import { useIsMutating } from '@tanstack/react-query';
import { normalizeTitle, TITLE_MAX_LENGTH } from '@nodii/core';
import {
  todoWriteKey,
  useToggleTodo,
  useRenameTodo,
  useDeleteTodo,
  type NodiiClient,
  type TodoRecord,
} from '@nodii/api';
import { toast } from 'sonner';
import { TodoMenu } from './TodoMenu';
import { notifyError } from '../../lib/notify-error';

/** 체크·인라인 편집·우클릭 메뉴가 같은 낙관적 행을 조작한다 (TODO-02~04). */
export function TodoRow({
  todo,
  client,
  weekStart,
  timeZone,
}: {
  todo: TodoRecord;
  client: NodiiClient;
  weekStart: 0 | 1;
  timeZone: string;
}) {
  const online = useConnectivity();
  const options = { onError: notifyError };
  const toggle = useToggleTodo(client, weekStart, todo.id, options);
  const rename = useRenameTodo(client, weekStart, todo.id, options);
  const remove = useDeleteTodo(client, weekStart, todo.id, options);
  const updating = useIsMutating({ mutationKey: todoWriteKey(todo.id) });
  const creating = useIsMutating({
    mutationKey: ['write', 'todo', 'create'],
    predicate: (mutation) =>
      (mutation.state.variables as { id?: string } | undefined)?.id === todo.id,
  });
  const importing = useIsMutating({ mutationKey: ['write', 'import'] });
  const restoring = useIsMutating({ mutationKey: todoWriteKey('import-undo') });
  const pending = updating > 0 || creating > 0 || importing > 0 || restoring > 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const titleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelEdit = useRef(false);
  const wasEditing = useRef(false);
  function edit() {
    setDraft(todo.title);
    setEditing(true);
    cancelEdit.current = false;
  }
  function save() {
    if (cancelEdit.current) return;
    const title = normalizeTitle(draft);
    if (title && title !== todo.title) rename.mutate({ todo, title });
    setEditing(false);
  }
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditing.current) titleRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  function deleteTodo() {
    titleRef.current?.closest('section')?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
    // 즉시 실행 취소를 표시하되 복원 요청은 삭제 응답 뒤에 보내 역전을 막는다.
    const deletion = remove.mutateAsync({ todo });
    const toastId = toast('할 일을 삭제했어요', {
      duration: 5000,
      action: {
        label: '실행 취소',
        onClick: () => {
          void deletion
            .then(() => remove.mutate({ todo, restore: true }))
            .catch(() => {
              /* 삭제 실패는 공통 onError에서 안내한다. */
            });
        },
      },
    });
    void deletion.catch(() => {
      toast.dismiss(toastId); /* 공통 onError가 롤백과 재시도를 안내한다. */
    });
  }
  return (
    <TodoMenu
      todo={todo}
      client={client}
      weekStart={weekStart}
      timeZone={timeZone}
      pending={pending}
      editing={editing}
      onEdit={edit}
      onDelete={deleteTodo}
    >
      <button
        type="button"
        className="todo-check"
        aria-disabled={!online || undefined}
        aria-label={`${todo.title} 완료`}
        aria-pressed={todo.isDone}
        disabled={pending}
        onClick={() => toggle.mutate(todo)}
      >
        {todo.isDone && (
          <svg viewBox="0 0 22 22" aria-hidden="true">
            <path d="m5 11 4 4 8-8" />
          </svg>
        )}
      </button>
      {editing ? (
        <input
          ref={inputRef}
          className="todo-edit"
          aria-label="할 일 제목 수정"
          maxLength={TITLE_MAX_LENGTH}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={save}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              cancelEdit.current = true;
              setEditing(false);
              titleRef.current?.focus();
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              save();
              titleRef.current?.focus();
            }
          }}
        />
      ) : (
        <button
          ref={titleRef}
          type="button"
          className="todo-title"
          disabled={pending}
          onDoubleClick={edit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              edit();
            }
          }}
        >
          {todo.title}
        </button>
      )}
    </TodoMenu>
  );
}
