import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import type { Command } from '../types';

/**
 * 新增 widget 命令
 * - execute: 调用 store._addWidget 将 widget 挂入对应父链
 * - undo: 调用 store._removeWidget 将其（及其子树）从画布移除
 */
export class AddWidgetCommand implements Command {
  readonly name = 'AddWidget';

  constructor(private readonly widget: Widget) {}

  execute(): void {
    useEditorStore.getState()._addWidget(this.widget);
  }

  undo(): void {
    useEditorStore.getState()._removeWidget(this.widget.id);
  }
}
