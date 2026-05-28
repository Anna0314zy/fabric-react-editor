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

export type CanvasAspect = '16:9' | '4:3';
export type ZoomMode = 'fit' | 'manual';

const CANVAS_SIZE_BY_ASPECT: Record<CanvasAspect, Pick<PageData, 'width' | 'height'>> = {
  '16:9': { width: 1280, height: 720 },
  '4:3': { width: 1024, height: 768 },
};

const ZOOM_STEP = 0.1;
const clampZoom = (zoom: number): number => Math.min(4, Math.max(0.1, zoom));
const normalizeZoom = (zoom: number): number => Number(clampZoom(zoom).toFixed(3));

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
  /** 最近一批 widget 属性变更：widgetId -> patch，用于 Canvas 增量同步 */
  widgetPatches: Record<string, Partial<Widget>>;
  /** widgetPatches 版本号；每次属性变更递增，供 Canvas 低成本订阅 */
  // widgetPatchVersion 是一个轻量变更信号，widgetPatches 是真实增量数据。Canvas 订阅 version，读取 patches，从而避免订阅大对象 widgets 造成全量扫描。
  widgetPatchVersion: number;

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
  /** 缩放模式：fit 随容器变化自动适应，manual 由用户手动控制 */
  zoomMode: ZoomMode;
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
  /** 清理已被 Canvas 消费的属性 patch */
  _clearWidgetPatches: (version: number) => void;

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
  setZoom: (zoom: number, mode?: ZoomMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPageAspect: (aspect: CanvasAspect) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  // document
  pages: PRESET_PAGES,
  widgets: PRESET_WIDGETS,
  rootIds: PRESET_ROOT_IDS,
  childIds: PRESET_CHILD_IDS,
  widgetPatches: {},
  widgetPatchVersion: 0,

  // ui
  activePageId: PRESET_ACTIVE_PAGE_ID,
  selectedIds: [],
  hoveredId: undefined,
  editingTextId: undefined,
  zoom: 1,
  zoomMode: 'fit',
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
        widgetPatches: {
          ...state.widgetPatches,
          [id]: {
            ...(state.widgetPatches[id] ?? {}),
            ...patch,
          },
        },
        widgetPatchVersion: state.widgetPatchVersion + 1,
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
        widgetPatches: Object.fromEntries(
          Object.entries(state.widgetPatches).filter(([wid]) => !toRemove.has(wid)),
        ),
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

  _clearWidgetPatches: (version) =>
    set((state) => {
      if (state.widgetPatchVersion !== version) return state;
      if (Object.keys(state.widgetPatches).length === 0) return state;
      return { widgetPatches: {} };
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
  setZoom: (zoom, mode = 'manual') => set({ zoom: normalizeZoom(zoom), zoomMode: mode }),
  zoomIn: () =>
    set((state) => ({ zoom: normalizeZoom(state.zoom + ZOOM_STEP), zoomMode: 'manual' })),
  zoomOut: () =>
    set((state) => ({ zoom: normalizeZoom(state.zoom - ZOOM_STEP), zoomMode: 'manual' })),
  setPageAspect: (aspect) =>
    set((state) => {
      const page = state.pages[state.activePageId];
      if (!page) return state;
      return {
        pages: {
          ...state.pages,
          [page.id]: {
            ...page,
            ...CANVAS_SIZE_BY_ASPECT[aspect],
          },
        },
        zoomMode: 'fit',
      };
    }),
}));
