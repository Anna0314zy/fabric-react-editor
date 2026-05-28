import { useEditorStore } from '@/store';
import type { Command } from '../types';

/**
 * 根层级 widget 重排序命令（图层面板上下移动）
 * - execute: 将 pageId 对应 rootIds 列表里 from 位置元素移动到 to
 * - undo: 反向移动（from / to 对调）
 */
export class ReorderWidgetCommand implements Command {
  readonly name = 'ReorderWidget';

  constructor(
    private readonly pageId: string,
    private readonly from: number,
    private readonly to: number,
  ) {}

  execute(): void {
    useEditorStore.getState()._reorderWidget(this.pageId, this.from, this.to);
  }

  undo(): void {
    useEditorStore.getState()._reorderWidget(this.pageId, this.to, this.from);
  }
}
