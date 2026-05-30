import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import type { Command } from '../types';

export interface PatchWidgetsCommandOptions {
  name?: string;
  mergeKey?: string;
}

type WidgetPatches = Record<string, Partial<Widget>>;

function mergeWidgetPatches(a: WidgetPatches, b: WidgetPatches): WidgetPatches {
  const result: WidgetPatches = { ...a };
  Object.entries(b).forEach(([id, patch]) => {
    result[id] = { ...(result[id] ?? {}), ...patch };
  });
  return result;
}

/**
 * 通用 widget 属性 patch 命令。
 * 默认每次 dispatch 都是一条独立历史；只有显式传入相同 mergeKey 的连续操作才合并。
 */
export class PatchWidgetsCommand implements Command {
  readonly name: string;

  private beforePatches: WidgetPatches = {};
  private readonly mergeKey?: string;

  constructor(
    private readonly patches: WidgetPatches,
    options: PatchWidgetsCommandOptions = {},
  ) {
    this.name = options.name ?? 'PatchWidgets';
    this.mergeKey = options.mergeKey;
  }

  execute(): void {
    const state = useEditorStore.getState();
    const beforePatches: WidgetPatches = {};

    Object.entries(this.patches).forEach(([id, patch]) => {
      const widget = state.widgets[id];
      if (!widget) return;

      const before: Record<string, unknown> = {};
      Object.keys(patch).forEach((key) => {
        before[key] = (widget as unknown as Record<string, unknown>)[key];
      });
      beforePatches[id] = before as Partial<Widget>;
    });

    this.beforePatches = beforePatches;
    state._applyWidgetPatches(this.patches);
  }

  undo(): void {
    useEditorStore.getState()._applyWidgetPatches(this.beforePatches);
  }

  merge(prev: Command): Command | null {
    if (!this.mergeKey || !(prev instanceof PatchWidgetsCommand)) return null;
    if (prev.mergeKey !== this.mergeKey) return null;

    const merged = new PatchWidgetsCommand(mergeWidgetPatches(prev.patches, this.patches), {
      name: this.name,
      mergeKey: this.mergeKey,
    });
    merged.beforePatches = mergeWidgetPatches(this.beforePatches, prev.beforePatches);
    return merged;
  }
}
