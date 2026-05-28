import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import type { Command } from '../types';

/**
 * 删除快照
 * - widgets：被删 widget 及其全部后代（顶层节点位于 widgets[0]）
 * - childIds：被删 group 节点自身的子链关系，用于还原编组结构
 * - parentId / pageId / index：顶层节点在父链中的原位置，用于精准还原顺序
 */
export interface RemoveSnapshot {
  pageId: string;
  parentId: string | null;
  index: number;
  widgets: Widget[];
  childIds: Record<string, string[]>;
}

/**
 * 删除 widget 命令
 * - execute: 记录被删子树快照，再调用 store._removeWidget 级联删除
 * - undo: 通过 store._restoreWidgets 将子树插回原位置
 */
export class RemoveWidgetCommand implements Command {
  readonly name = 'RemoveWidget';

  private snapshot: RemoveSnapshot | null = null;

  constructor(private readonly id: string) {}

  execute(): void {
    const state = useEditorStore.getState();
    const target = state.widgets[this.id];
    if (!target) return;

    // 递归收集子树：顶层节点放在首位，后续是后代
    const widgets: Widget[] = [];
    const childIds: Record<string, string[]> = {};
    const collect = (wid: string): void => {
      const w = state.widgets[wid];
      if (!w) return;
      widgets.push(w);
      const children = state.childIds[wid];
      if (children && children.length > 0) {
        childIds[wid] = [...children];
        children.forEach(collect);
      }
    };
    collect(this.id);

    // 定位顶层节点在父链中的索引，用于 undo 还原顺序
    const parentList =
      target.parentId === null
        ? (state.rootIds[target.pageId] ?? [])
        : (state.childIds[target.parentId] ?? []);
    const idx = parentList.indexOf(this.id);

    this.snapshot = {
      pageId: target.pageId,
      parentId: target.parentId,
      index: idx < 0 ? parentList.length : idx,
      widgets,
      childIds,
    };

    state._removeWidget(this.id);
  }

  undo(): void {
    if (!this.snapshot) return;
    useEditorStore.getState()._restoreWidgets(this.snapshot);
  }
}
