import { history } from '@/core/history';
import { commandManager } from './CommandManager';

/**
 * 注册编辑器内置命令
 * - 必须在应用启动时调用一次（早于 registerBuiltinShortcuts）
 * - 后续新增功能（删除 widget、复制粘贴、对齐、缩放等）一律在此扩展
 */
export function registerBuiltinCommands(): void {
  commandManager.register({
    id: 'editor.undo',
    title: '撤销',
    run: () => history.undo(),
  });

  commandManager.register({
    id: 'editor.redo',
    title: '重做',
    run: () => history.redo(),
  });
}
