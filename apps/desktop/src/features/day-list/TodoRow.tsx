import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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
import { Button } from '../../components/ui/button';
import { notifyError } from '../../lib/notify-error';

/** 체크·인라인 편집·우클릭 메뉴가 같은 낙관적 행을 조작한다 (TODO-02~04). */
export function TodoRow({
  todo,
  client,
  weekStart,
}: {
  todo: TodoRecord;
  client: NodiiClient;
  weekStart: 0 | 1;
}) {
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
  const pending = updating > 0 || creating > 0;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const titleRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelEdit = useRef(false);
  const wasEditing = useRef(false);
  const menuId = `todo-menu-${todo.id}`;
  function edit() {
    setMenu(null);
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
  function openMenu(x: number, y: number) {
    if (pending) return;
    setMenu({ left: Math.max(8, Math.min(x, window.innerWidth - 220 - 8)), top: y });
  }
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else if (wasEditing.current) titleRef.current?.focus();
    wasEditing.current = editing;
  }, [editing]);
  useEffect(() => {
    if (!menu) return;
    const element = menuRef.current;
    if (element) {
      element.style.top = `${Math.max(8, Math.min(menu.top, window.innerHeight - element.getBoundingClientRect().height - 8))}px`;
      element.querySelector<HTMLButtonElement>('button')?.focus();
    }
    const close = (event: Event) => {
      if (
        event.type === 'pointerdown' &&
        event.target instanceof Node &&
        (menuRef.current?.contains(event.target) || moreRef.current?.contains(event.target))
      )
        return;
      setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [menu]);
  function deleteTodo() {
    moreRef.current?.closest('section')?.querySelector<HTMLButtonElement>('.goal-chip')?.focus();
    setMenu(null);
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
    <div
      className={`todo-row${todo.isDone ? ' todo-done' : ''}`}
      onContextMenu={(event) => {
        if (editing) return;
        event.preventDefault();
        openMenu(event.clientX, event.clientY);
      }}
    >
      <button
        type="button"
        className="todo-check"
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
      <Button
        ref={moreRef}
        variant="ghost"
        className="todo-more"
        aria-label={`${todo.title} 메뉴`}
        aria-haspopup="menu"
        aria-expanded={!!menu}
        aria-controls={menuId}
        disabled={pending}
        onClick={() => {
          const rect = moreRef.current!.getBoundingClientRect();
          if (menu) setMenu(null);
          else openMenu(rect.right - 220, rect.bottom);
        }}
      >
        ⋯
      </Button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            className="todo-menu"
            style={menu}
            role="menu"
            aria-label="할 일 메뉴"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setMenu(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                setMenu(null);
                moreRef.current?.focus();
              }
              if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const items = Array.from(
                  event.currentTarget.querySelectorAll<HTMLButtonElement>('button'),
                );
                const index = items.indexOf(document.activeElement as HTMLButtonElement);
                items[
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? items.length - 1
                      : (index + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length
                ]?.focus();
              }
            }}
          >
            <Button role="menuitem" variant="ghost" onClick={edit}>
              수정
            </Button>
            <Button role="menuitem" variant="ghost" className="danger-text" onClick={deleteTodo}>
              삭제
            </Button>
          </div>,
          document.body,
        )}
    </div>
  );
}
