import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import type { Command } from '../types';

/**
 * 编组命令
 * - execute: 创建 group 根节点，并把选中的根节点挂到 group.childIds 下
 * - undo: 拆开刚创建的 group，把子节点放回 group 所在根层级位置
 */
export class GroupWidgetsCommand implements Command {
  readonly name = 'GroupWidgets';

  constructor(
    private readonly group: Extract<Widget, { type: 'group' }>,
    private readonly ids: string[],
  ) {}

  execute(): void {
    useEditorStore.getState()._groupWidgets(this.group, this.ids);
  }

  undo(): void {
    useEditorStore.getState()._ungroupWidget(this.group.id);
  }
}
