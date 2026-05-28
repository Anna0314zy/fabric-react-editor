import { create } from 'zustand';
import {
  PRESET_ACTIVE_PAGE_ID,
  PRESET_CHILD_IDS,
  PRESET_PAGES,
  PRESET_ROOT_IDS,
  PRESET_WIDGETS,
} from '../constants/presets';
import type { PageData } from '../types/page';
import type { Widget } from '../types/widget';
import { history } from '@/core/history';
import {
  AddWidgetCommand,
  RemoveWidgetCommand,
  ReorderWidgetCommand,
  UpdateWidgetCommand,
  type RemoveSnapshot,
} from '@/core/history/commands';

/** 编辑器全局状态 */
interface EditorState {
  // ========================
  // document
  // ========================
  /** 页面字典：pageId -> 页面元信息 */
  pages: Record<string, PageData>;
  /** 所有 widget 扁平池：widgetId -> Widget */
  widgets: Record<string, Widget>;
  /** 每个页面根层级 widget id 列表：pageId -> widgetId[]，决定渲染顺序 */
  rootIds: Record<string, string[]>;
  /** 每个 group 的子 widget id 列表：groupId -> widgetId[] */
  childIds: Record<string, string[]>;

  // ========================
  // ui
  // ========================
  /** 当前激活页面 id */
  activePageId: string;
  /** 当前选中 widget id 列表（支持多选） */
  selectedIds: string[];
  /** 当前 hover 的 widget id */
  hoveredId?: string;
  /** 正在编辑文本的 widget id */
  editingTextId?: string;
  /** 缩放比例 */
  zoom: number;
  /** 画布平移偏移 */
  pan: { x: number; y: number };

  // ========================
  // mutators（仅内部，不进历史）
  // ========================
  _addWidget: (widget: Widget) => void;
  _updateWidget: (id: string, patch: Partial<Widget>) => void;
  _removeWidget: (id: string) => void;
  _reorderWidget: (pageId: string, from: number, to: number) => void;
  /** 还原被删除子树（供 RemoveWidgetCommand.undo 使用） */
  _restoreWidgets: (snapshot: RemoveSnapshot) => void;

  // ========================
  // actions（对外，走 history）
  // ========================
  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, patch: Partial<Widget>) => void;
  removeWidget: (id: string) => void;
  reorderWidget: (pageId: string, from: number, to: number) => void;

  // ui actions
  setActivePage: (pageId: string) => void;
  setSelectedIds: (ids: string[]) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  // document
  pages: PRESET_PAGES,
  widgets: PRESET_WIDGETS,
  rootIds: PRESET_ROOT_IDS,
  childIds: PRESET_CHILD_IDS,

  // ui
  activePageId: PRESET_ACTIVE_PAGE_ID,
  selectedIds: [],
  hoveredId: undefined,
  editingTextId: undefined,
  zoom: 1,
  pan: { x: 0, y: 0 },

  // ========================
  // mutators
  // ========================
  _addWidget: (widget) =>
    set((state) => {
      const widgets = { ...state.widgets, [widget.id]: widget };
      if (widget.parentId === null) {
        const list = state.rootIds[widget.pageId] ?? [];
        return {
          widgets,
          rootIds: { ...state.rootIds, [widget.pageId]: [...list, widget.id] },
        };
      }
      const list = state.childIds[widget.parentId] ?? [];
      return {
        widgets,
        childIds: { ...state.childIds, [widget.parentId]: [...list, widget.id] },
      };
    }),

  _updateWidget: (id, patch) =>
    set((state) => {
      const target = state.widgets[id];
      if (!target) return state;
      return {
        widgets: {
          ...state.widgets,
          [id]: { ...target, ...patch } as Widget,
        },
      };
    }),

  _removeWidget: (id) =>
    set((state) => {
      const target = state.widgets[id];
      if (!target) return state;

      // 递归收集需要删除的 id（group 删除时连同子孙节点）
      const toRemove = new Set<string>();
      const collect = (wid: string) => {
        toRemove.add(wid);
        const children = state.childIds[wid];
        if (children) children.forEach(collect);
      };
      collect(id);

      // 1. 清理 widgets 池
      const widgets: Record<string, Widget> = {};
      Object.values(state.widgets).forEach((w) => {
        if (!toRemove.has(w.id)) widgets[w.id] = w;
      });

      // 2. 从父级链中摘除当前节点
      let rootIds = state.rootIds;
      let childIds = state.childIds;
      if (target.parentId === null) {
        const list = state.rootIds[target.pageId] ?? [];
        rootIds = {
          ...state.rootIds,
          [target.pageId]: list.filter((wid) => wid !== id),
        };
      } else {
        const list = state.childIds[target.parentId] ?? [];
        childIds = {
          ...state.childIds,
          [target.parentId]: list.filter((wid) => wid !== id),
        };
      }

      // 3. 清理被删 group 在 childIds 中遗留的条目
      const cleanedChildIds: Record<string, string[]> = {};
      Object.entries(childIds).forEach(([key, val]) => {
        if (!toRemove.has(key)) cleanedChildIds[key] = val;
      });

      // 4. 同步清理 UI 引用
      const selectedIds = state.selectedIds.filter((sid) => !toRemove.has(sid));
      const hoveredId =
        state.hoveredId && toRemove.has(state.hoveredId) ? undefined : state.hoveredId;
      const editingTextId =
        state.editingTextId && toRemove.has(state.editingTextId) ? undefined : state.editingTextId;

      return {
        widgets,
        rootIds,
        childIds: cleanedChildIds,
        selectedIds,
        hoveredId,
        editingTextId,
      };
    }),

  _reorderWidget: (pageId, from, to) =>
    set((state) => {
      const list = state.rootIds[pageId];
      if (!list || from < 0 || from >= list.length || to < 0 || to >= list.length) {
        return state;
      }
      const next = [...list];
      const [moved] = next.splice(from, 1);
      if (moved === undefined) return state;
      next.splice(to, 0, moved);
      return { rootIds: { ...state.rootIds, [pageId]: next } };
    }),

  _restoreWidgets: (snapshot) =>
    set((state) => {
      // 还原 widgets 池
      const widgets = { ...state.widgets };
      snapshot.widgets.forEach((w) => {
        widgets[w.id] = w;
      });

      // 还原 childIds（被删 group 自身的子链关系）
      const childIds = { ...state.childIds };
      Object.entries(snapshot.childIds).forEach(([gid, list]) => {
        childIds[gid] = [...list];
      });

      // 把顶层节点插回父链原位置
      const topId = snapshot.widgets[0]?.id;
      if (!topId) return { widgets, childIds };

      let rootIds = state.rootIds;
      if (snapshot.parentId === null) {
        const list = [...(state.rootIds[snapshot.pageId] ?? [])];
        const idx = Math.min(snapshot.index, list.length);
        list.splice(idx, 0, topId);
        rootIds = { ...state.rootIds, [snapshot.pageId]: list };
      } else {
        const list = [...(childIds[snapshot.parentId] ?? [])];
        const idx = Math.min(snapshot.index, list.length);
        list.splice(idx, 0, topId);
        childIds[snapshot.parentId] = list;
      }

      return { widgets, rootIds, childIds };
    }),

  // ========================
  // actions
  // ========================
  addWidget: (widget) => history.dispatch(new AddWidgetCommand(widget)),
  updateWidget: (id, patch) => history.dispatch(new UpdateWidgetCommand(id, patch)),
  removeWidget: (id) => history.dispatch(new RemoveWidgetCommand(id)),
  reorderWidget: (pageId, from, to) => history.dispatch(new ReorderWidgetCommand(pageId, from, to)),

  setActivePage: (pageId) => set({ activePageId: pageId, selectedIds: [] }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
}));
