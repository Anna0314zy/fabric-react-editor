import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import type { Command } from '../types';

/**
 * 更新 widget 属性命令
 * - execute: 先快照被改字段的旧值，再调用 store._updateWidget 应用 patch
 * - undo: 用 prev 快照覆盖回旧值
 * - merge: 同一 widget 的连续更新（如拖拽 / 缩放产生的高频小步）合并为单条历史，
 *         合并后的命令保留最早的 prev 快照，确保 undo 能一次回退到最初状态。
 */
export class UpdateWidgetCommand implements Command {
  readonly name = 'UpdateWidget';

  private prev: Partial<Widget> = {};

  constructor(
    private readonly id: string,
    private readonly patch: Partial<Widget>,
  ) {}

  execute(): void {
    const state = useEditorStore.getState();
    const target = state.widgets[this.id];
    if (!target) return;

    const prev: Record<string, unknown> = {};
    for (const key of Object.keys(this.patch)) {
      prev[key] = (target as unknown as Record<string, unknown>)[key];
    }
    this.prev = prev as Partial<Widget>;

    state._updateWidget(this.id, this.patch);
  }

  undo(): void {
    useEditorStore.getState()._updateWidget(this.id, this.prev);
  }

  merge(prev: Command): Command | null {
    if (!(prev instanceof UpdateWidgetCommand)) return null;
    if (prev.id !== this.id) return null;

    // 当前命令已经 execute 过，状态为合并后的最新值；
    // 合并命令保留最早的 prev 用于一次性 undo，patch 取并集（this 覆盖 prev 的同名键）。
    const merged = new UpdateWidgetCommand(this.id, { ...prev.patch, ...this.patch });
    merged.prev = { ...this.prev, ...prev.prev } as Partial<Widget>;
    return merged;
  }
}
