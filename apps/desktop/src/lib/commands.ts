import { isTauri } from '@tauri-apps/api/core';
import type { MenuOptions } from '@tauri-apps/api/menu';

export type AppCommand = 'settings' | 'new-todo' | 'today';
/** 메뉴와 브라우저 단축키가 동일한 화면 동작을 호출한다 (SET-03). */
export function dispatchCommand(command: AppCommand) {
  window.dispatchEvent(new CustomEvent<AppCommand>('nodii:command', { detail: command }));
}
/** 네이티브는 메뉴 accelerator를 쓰므로 keydown의 중복 실행을 피한다. */
export function startBrowserShortcuts() {
  if (isTauri()) return () => {};
  const key = (event: KeyboardEvent) => {
    if (
      !event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      event.shiftKey ||
      event.isComposing ||
      event.repeat ||
      event.defaultPrevented
    )
      return;
    const command = ({ n: 'new-todo', t: 'today', ',': 'settings' } as const)[
      event.key.toLowerCase() as 'n' | 't' | ','
    ];
    if (command) {
      event.preventDefault();
      dispatchCommand(command);
    }
  };
  window.addEventListener('keydown', key);
  return () => window.removeEventListener('keydown', key);
}
/** 편집·창·앱 기본 기능은 macOS predefined 항목으로 유지한다. */
export function appMenuOptions(): MenuOptions {
  return {
    items: [
      {
        text: 'Nodii',
        items: [
          { text: 'Nodii 정보', item: { About: null } },
          {
            id: 'settings',
            text: '설정…',
            accelerator: 'CmdOrCtrl+,',
            action: () => dispatchCommand('settings'),
          },
          { item: 'Separator' },
          { text: '서비스', item: 'Services' },
          { text: 'Nodii 가리기', item: 'Hide' },
          { text: '기타 가리기', item: 'HideOthers' },
          { text: '모두 보기', item: 'ShowAll' },
          { item: 'Separator' },
          { text: 'Nodii 종료', item: 'Quit' },
        ],
      },
      {
        text: '파일',
        items: [
          {
            id: 'new-todo',
            text: '새 할 일',
            accelerator: 'CmdOrCtrl+N',
            action: () => dispatchCommand('new-todo'),
          },
          { text: '창 닫기', item: 'CloseWindow' },
        ],
      },
      {
        text: '편집',
        items: [
          { text: '실행 취소', item: 'Undo' },
          { text: '다시 실행', item: 'Redo' },
          { item: 'Separator' },
          { text: '잘라내기', item: 'Cut' },
          { text: '복사', item: 'Copy' },
          { text: '붙여넣기', item: 'Paste' },
          { text: '모두 선택', item: 'SelectAll' },
        ],
      },
      {
        text: '보기',
        items: [
          {
            id: 'today',
            text: '오늘',
            accelerator: 'CmdOrCtrl+T',
            action: () => dispatchCommand('today'),
          },
          { text: '전체 화면', item: 'Fullscreen' },
        ],
      },
      {
        text: '윈도우',
        items: [
          { text: '최소화', item: 'Minimize' },
          { text: '확대/축소', item: 'Maximize' },
          { text: '모두 앞으로 가져오기', item: 'BringAllToFront' },
        ],
      },
    ],
  };
}
/** 앱 수명 동안 메뉴를 한 번만 설치하며 브라우저에서는 IPC를 호출하지 않는다. */
export async function installAppMenu() {
  if (!isTauri()) return;
  const { Menu } = await import('@tauri-apps/api/menu');
  const menu = await Menu.new(appMenuOptions());
  await menu.setAsAppMenu();
}
