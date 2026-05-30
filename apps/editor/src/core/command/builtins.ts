import { history } from '@/core/history';
import { canvasEngine, type AlignType } from '@/core/engine';
import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import { commandManager } from './CommandManager';

function getSelection(): { selectedIds: string[]; widgets: Record<string, Widget> } {
  const state = useEditorStore.getState();
  return { selectedIds: state.selectedIds, widgets: state.widgets };
}

function getSelectedWidgets(): Widget[] {
  const { selectedIds, widgets } = getSelection();
  return selectedIds.map((id) => widgets[id]).filter((w): w is Widget => !!w);
}

function hasSelection(): boolean {
  return useEditorStore.getState().selectedIds.length > 0;
}

function hasSingleSelection(): boolean {
  return useEditorStore.getState().selectedIds.length === 1;
}

function hasMultiSelection(): boolean {
  return useEditorStore.getState().selectedIds.length > 1;
}

function getSingleRootIndex(): { pageId: string; from: number; list: string[] } | null {
  const state = useEditorStore.getState();
  const id = state.selectedIds[0];
  if (!id) return null;
  const widget = state.widgets[id];
  if (!widget || widget.parentId !== null) return null;
  const list = state.rootIds[state.activePageId] ?? [];
  const from = list.indexOf(id);
  if (from < 0) return null;
  return { pageId: state.activePageId, from, list };
}

function moveSingleLayer(to: number): void {
  const info = getSingleRootIndex();
  if (!info || info.from === to) return;
  useEditorStore.getState().reorderWidget(info.pageId, info.from, to);
}

function alignSelected(type: AlignType): void {
  const state = useEditorStore.getState();
  const widgets = state.selectedIds.map((id) => state.widgets[id]).filter((w): w is Widget => !!w);
  if (widgets.length < 2) return;

  const getWidth = (widget: Widget) => widget.width * widget.scaleX;
  const getHeight = (widget: Widget) => widget.height * widget.scaleY;
  const minLeft = Math.min(...widgets.map((widget) => widget.left));
  const minTop = Math.min(...widgets.map((widget) => widget.top));
  const maxRight = Math.max(...widgets.map((widget) => widget.left + getWidth(widget)));
  const maxBottom = Math.max(...widgets.map((widget) => widget.top + getHeight(widget)));
  const centerX = (minLeft + maxRight) / 2;
  const centerY = (minTop + maxBottom) / 2;

  const patches = Object.fromEntries(
    widgets.map((widget) => {
      switch (type) {
        case 'left':
          return [widget.id, { left: minLeft }];
        case 'centerX':
          return [widget.id, { left: centerX - getWidth(widget) / 2 }];
        case 'right':
          return [widget.id, { left: maxRight - getWidth(widget) }];
        case 'top':
          return [widget.id, { top: minTop }];
        case 'centerY':
          return [widget.id, { top: centerY - getHeight(widget) / 2 }];
        case 'bottom':
          return [widget.id, { top: maxBottom - getHeight(widget) }];
      }
    }),
  );
  if (Object.keys(patches).length === 0) return;
  state.updateWidgets(patches);
}

function isTextWidget(widget?: Widget): widget is Extract<Widget, { type: 'text' | 'i-text' }> {
  return widget?.type === 'text' || widget?.type === 'i-text';
}

function genGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `g-${crypto.randomUUID()}`;
  }
  return `g-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getGroupableRootIds(): string[] {
  const state = useEditorStore.getState();
  const rootIds = state.rootIds[state.activePageId] ?? [];
  const rootIdSet = new Set(rootIds);
  return state.selectedIds.filter((id) => rootIdSet.has(id) && state.widgets[id]?.type !== 'group');
}

function canGroupSelection(): boolean {
  return getGroupableRootIds().length > 1;
}

function canUngroupSelection(): boolean {
  const widget = getSelectedWidgets()[0];
  return useEditorStore.getState().selectedIds.length === 1 && widget?.type === 'group';
}

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

  commandManager.register({
    id: 'widget.deleteSelected',
    title: '删除选中组件',
    canExecute: hasSelection,
    run: () => {
      const ids = [...useEditorStore.getState().selectedIds];
      ids.forEach((id) => useEditorStore.getState().removeWidget(id));
    },
  });

  commandManager.register({
    id: 'widget.toggleLocked',
    title: '锁定/解锁',
    canExecute: hasSelection,
    run: () => {
      const widgets = getSelectedWidgets();
      const shouldLock = widgets.some((w) => !w.locked);
      const patches = Object.fromEntries(widgets.map((w) => [w.id, { locked: shouldLock }]));
      useEditorStore.getState().updateWidgets(patches, { name: 'ToggleLocked' });
    },
  });

  commandManager.register({
    id: 'widget.toggleVisible',
    title: '显示/隐藏',
    canExecute: hasSelection,
    run: () => {
      const widgets = getSelectedWidgets();
      const shouldShow = widgets.some((w) => w.visible === false);
      const patches = Object.fromEntries(widgets.map((w) => [w.id, { visible: shouldShow }]));
      useEditorStore.getState().updateWidgets(patches, { name: 'ToggleVisible' });
    },
  });

  commandManager.register({
    id: 'widget.groupSelected',
    title: '编组',
    canExecute: canGroupSelection,
    run: () => {
      const state = useEditorStore.getState();
      const ids = getGroupableRootIds();
      if (ids.length < 2) return;

      const boxes = ids.map((id) => canvasEngine.getBoundingBox(id)).filter(Boolean);
      if (boxes.length !== ids.length) return;

      const left = Math.min(...boxes.map((box) => box.left));
      const top = Math.min(...boxes.map((box) => box.top));
      const right = Math.max(...boxes.map((box) => box.left + box.width));
      const bottom = Math.max(...boxes.map((box) => box.top + box.height));
      const group: Extract<Widget, { type: 'group' }> = {
        id: genGroupId(),
        type: 'group',
        name: '编组',
        pageId: state.activePageId,
        parentId: null,
        left,
        top,
        width: right - left,
        height: bottom - top,
        angle: 0,
        scaleX: 1,
        scaleY: 1,
        childrenIds: ids,
      };

      state.groupWidgets(group, ids);
    },
  });

  commandManager.register({
    id: 'widget.ungroupSelected',
    title: '取消编组',
    canExecute: canUngroupSelection,
    run: () => {
      const group = getSelectedWidgets()[0];
      if (!group || group.type !== 'group') return;
      useEditorStore.getState().ungroupWidget(group.id);
    },
  });

  commandManager.register({
    id: 'layer.moveUp',
    title: '上移一层',
    canExecute: () => {
      const info = getSingleRootIndex();
      return !!info && info.from < info.list.length - 1;
    },
    run: () => {
      const info = getSingleRootIndex();
      if (!info) return;
      moveSingleLayer(Math.min(info.list.length - 1, info.from + 1));
    },
  });

  commandManager.register({
    id: 'layer.moveDown',
    title: '下移一层',
    canExecute: () => {
      const info = getSingleRootIndex();
      return !!info && info.from > 0;
    },
    run: () => {
      const info = getSingleRootIndex();
      if (!info) return;
      moveSingleLayer(Math.max(0, info.from - 1));
    },
  });

  commandManager.register({
    id: 'layer.bringToFront',
    title: '置顶',
    canExecute: hasSingleSelection,
    run: () => {
      const info = getSingleRootIndex();
      if (!info) return;
      moveSingleLayer(info.list.length - 1);
    },
  });

  commandManager.register({
    id: 'layer.sendToBack',
    title: '置底',
    canExecute: hasSingleSelection,
    run: () => moveSingleLayer(0),
  });

  commandManager.register({
    id: 'widget.alignLeft',
    title: '左对齐',
    canExecute: hasMultiSelection,
    run: () => alignSelected('left'),
  });

  commandManager.register({
    id: 'widget.alignCenterX',
    title: '水平居中',
    canExecute: hasMultiSelection,
    run: () => alignSelected('centerX'),
  });

  commandManager.register({
    id: 'widget.alignRight',
    title: '右对齐',
    canExecute: hasMultiSelection,
    run: () => alignSelected('right'),
  });

  commandManager.register({
    id: 'widget.alignTop',
    title: '顶对齐',
    canExecute: hasMultiSelection,
    run: () => alignSelected('top'),
  });

  commandManager.register({
    id: 'widget.alignCenterY',
    title: '垂直居中',
    canExecute: hasMultiSelection,
    run: () => alignSelected('centerY'),
  });

  commandManager.register({
    id: 'widget.alignBottom',
    title: '底对齐',
    canExecute: hasMultiSelection,
    run: () => alignSelected('bottom'),
  });

  commandManager.register({
    id: 'text.toggleBold',
    title: '加粗',
    canExecute: () => isTextWidget(getSelectedWidgets()[0]),
    run: () => {
      const widget = getSelectedWidgets()[0];
      if (!isTextWidget(widget)) return;
      useEditorStore
        .getState()
        .updateWidget(widget.id, { fontWeight: widget.fontWeight === 'bold' ? 'normal' : 'bold' });
    },
  });

  commandManager.register({
    id: 'text.toggleItalic',
    title: '斜体',
    canExecute: () => isTextWidget(getSelectedWidgets()[0]),
    run: () => {
      const widget = getSelectedWidgets()[0];
      if (!isTextWidget(widget)) return;
      useEditorStore.getState().updateWidget(widget.id, {
        fontStyle: widget.fontStyle === 'italic' ? 'normal' : 'italic',
      });
    },
  });

  commandManager.register({
    id: 'text.toggleUnderline',
    title: '下划线',
    canExecute: () => isTextWidget(getSelectedWidgets()[0]),
    run: () => {
      const widget = getSelectedWidgets()[0];
      if (!isTextWidget(widget)) return;
      useEditorStore.getState().updateWidget(widget.id, { underline: !widget.underline });
    },
  });
}
