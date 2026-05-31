import { registerBuiltinCommands } from '@/core/command';
import { registerBuiltinContextMenus } from '@/core/contextMenu';
import { registerBuiltinFloatingMenus } from '@/core/floatingMenu';
import { registerBuiltinShortcuts } from '@/core/shortcut';

let initialized = false;

/**
 * 编辑器启动初始化
 * - 注册内置命令（CommandManager）
 * - 注册内置快捷键（ShortcutManager 绑定 commandId）
 * - 顺序敏感：命令必须先于快捷键
 * - 幂等：多次调用只生效一次（兼容 React StrictMode 的二次挂载）
 */
export function initEditor(): void {
  if (initialized) return;
  registerBuiltinCommands();
  registerBuiltinContextMenus();
  registerBuiltinFloatingMenus();
  registerBuiltinShortcuts();
  initialized = true;
}
