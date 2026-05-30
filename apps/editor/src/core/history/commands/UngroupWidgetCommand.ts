import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import type { Command } from '../types';

/**
 * 取消编组命令
 * - execute: 移除 group 节点，并把子节点提升回根层级
 * - undo: 用原 group 数据重新编组
 */
export class UngroupWidgetCommand implements Command {
  readonly name = 'UngroupWidget';

  private group: Extract<Widget, { type: 'group' }> | null = null;
  private childIds: string[] = [];

  constructor(private readonly groupId: string) {}

  execute(): void {
    const state = useEditorStore.getState();
    const widget = state.widgets[this.groupId];
    if (!widget || widget.type !== 'group') return;
    this.group = widget;
    this.childIds = [...(state.childIds[this.groupId] ?? widget.childrenIds)];
    state._ungroupWidget(this.groupId);
  }

  undo(): void {
    if (!this.group || this.childIds.length === 0) return;
    useEditorStore.getState()._groupWidgets(this.group, this.childIds);
  }
}
