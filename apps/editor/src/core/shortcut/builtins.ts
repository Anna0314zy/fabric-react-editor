import { shortcutManager } from './ShortcutManager';

/**
 * 注册编辑器内置快捷键
 * - 必须在 registerBuiltinCommands 之后调用
 * - mod = ⌘(macOS) / Ctrl(Windows/Linux)
 */
export function registerBuiltinShortcuts(): void {
  shortcutManager.registerMany([
    {
      keys: 'mod+z',
      commandId: 'editor.undo',
      scope: 'global',
    },
    {
      keys: 'mod+y',
      commandId: 'editor.redo',
      scope: 'global',
    },
  ]);
}
