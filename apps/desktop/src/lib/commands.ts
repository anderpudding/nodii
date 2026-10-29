import { t } from '@nodii/i18n';
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
          { text: t('menu.about'), item: { About: null } },
          {
            id: 'settings',
            text: t('menu.settings'),
            accelerator: 'CmdOrCtrl+,',
            action: () => dispatchCommand('settings'),
          },
          { item: 'Separator' },
          { text: t('menu.services'), item: 'Services' },
          { text: t('menu.hide'), item: 'Hide' },
          { text: t('menu.hideOthers'), item: 'HideOthers' },
          { text: t('menu.showAll'), item: 'ShowAll' },
          { item: 'Separator' },
          { text: t('menu.quit'), item: 'Quit' },
        ],
      },
      {
        text: t('menu.file'),
        items: [
          {
            id: 'new-todo',
            text: t('menu.newTodo'),
            accelerator: 'CmdOrCtrl+N',
            action: () => dispatchCommand('new-todo'),
          },
          { text: t('menu.closeWindow'), item: 'CloseWindow' },
        ],
      },
      {
        text: t('menu.edit'),
        items: [
          { text: t('todo.undo'), item: 'Undo' },
          { text: t('menu.redo'), item: 'Redo' },
          { item: 'Separator' },
          { text: t('menu.cut'), item: 'Cut' },
          { text: t('menu.copy'), item: 'Copy' },
          { text: t('menu.paste'), item: 'Paste' },
          { text: t('menu.selectAll'), item: 'SelectAll' },
        ],
      },
      {
        text: t('settings.view'),
        items: [
          {
            id: 'today',
            text: t('day.today'),
            accelerator: 'CmdOrCtrl+T',
            action: () => dispatchCommand('today'),
          },
          { text: t('menu.fullscreen'), item: 'Fullscreen' },
        ],
      },
      {
        text: t('menu.window'),
        items: [
          { text: t('menu.minimize'), item: 'Minimize' },
          { text: t('menu.maximize'), item: 'Maximize' },
          { text: t('menu.bringAllToFront'), item: 'BringAllToFront' },
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
