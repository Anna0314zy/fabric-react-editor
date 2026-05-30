import { useEditorStore } from '@/store';
import type { GroupLayout, Widget } from '@/types/widget';
import type { Command } from '../types';

/**
 * 应用 group 布局命令
 * - execute: 写入 group.layout，并按布局批量更新子元素坐标 / 尺寸
 * - undo: 恢复 group 原布局和被布局影响的子元素字段
 */
export class ApplyGroupLayoutCommand implements Command {
  readonly name = 'ApplyGroupLayout';

  private prevGroupPatch: Partial<Widget> = {};
  private prevChildPatches: Record<string, Partial<Widget>> = {};

  constructor(
    private readonly groupId: string,
    private readonly layout: GroupLayout,
  ) {}

  execute(): void {
    const state = useEditorStore.getState();
    const group = state.widgets[this.groupId];
    if (!group || group.type !== 'group') return;

    this.prevGroupPatch = { layout: group.layout } as Partial<Widget>;
    const nextChildPatches = state.getGroupLayoutPatches(this.groupId, this.layout);

    this.prevChildPatches = Object.fromEntries(
      Object.entries(nextChildPatches).map(([id, patch]) => {
        const widget = state.widgets[id];
        if (!widget) return [id, {}];
        const prev: Record<string, unknown> = {};
        Object.keys(patch).forEach((key) => {
          prev[key] = (widget as unknown as Record<string, unknown>)[key];
        });
        return [id, prev as Partial<Widget>];
      }),
    );

    state._applyGroupLayout(this.groupId, this.layout, nextChildPatches);
  }

  undo(): void {
    useEditorStore.getState()._applyWidgetPatches({
      [this.groupId]: this.prevGroupPatch,
      ...this.prevChildPatches,
    });
  }
}
