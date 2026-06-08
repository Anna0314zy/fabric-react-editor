import { create, type StoreApi, type UseBoundStore } from 'zustand';
import {
  PRESET_ACTIVE_PAGE_ID,
  PRESET_CHILD_IDS,
  PRESET_PAGES,
  PRESET_ROOT_IDS,
  PRESET_WIDGETS,
} from '../constants/presets';
import type { PageData } from '../types/page';
import type { GroupLayout, Widget } from '../types/widget';
import { history } from '@/core/history';
import {
  ApplyGroupLayoutCommand,
  AddWidgetCommand,
  RemoveWidgetCommand,
  ReorderWidgetCommand,
  PatchWidgetsCommand,
  GroupWidgetsCommand,
  UngroupWidgetCommand,
  type PatchWidgetsCommandOptions,
  type RemoveSnapshot,
} from '@/core/history/commands';
import { computeGroupLayoutPatches } from '@/core/layout/groupLayout';
import type { EditorDocumentSnapshot } from '@/core/history/snapshot';

export type CanvasAspect = '16:9' | '4:3';
export type ZoomMode = 'fit' | 'manual';

const CANVAS_SIZE_BY_ASPECT: Record<CanvasAspect, Pick<PageData, 'width' | 'height'>> = {
  '16:9': { width: 1280, height: 720 },
  '4:3': { width: 1024, height: 768 },
};

const ZOOM_STEP = 0.1;
const clampZoom = (zoom: number): number => Math.min(4, Math.max(0.1, zoom));
const normalizeZoom = (zoom: number): number => Number(clampZoom(zoom).toFixed(3));

function getChangedPatch(widget: Widget | undefined, patch: Partial<Widget>): Partial<Widget> {
  if (!widget) return {};

  const changed: Record<string, unknown> = {};
  Object.entries(patch).forEach(([key, value]) => {
    if (!Object.is((widget as unknown as Record<string, unknown>)[key], value)) {
      changed[key] = value;
    }
  });
  return changed as Partial<Widget>;
}

function getChangedWidgetPatches(
  widgets: Record<string, Widget>,
  patches: Record<string, Partial<Widget>>,
): Record<string, Partial<Widget>> {
  return Object.fromEntries(
    Object.entries(patches).flatMap(([id, patch]) => {
      const changed = getChangedPatch(widgets[id], patch);
      return Object.keys(changed).length > 0 ? [[id, changed]] : [];
    }),
  );
}

/** 编辑器全局状态 */
export interface EditorState {
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
  /** 完整文档恢复版本；变化时 Canvas 放弃增量 diff 并全量重建 */
  documentRevision: number;

  // ========================
  // ui
  // ========================
  /** 当前激活页面 id */
  activePageId: string;
  /** 当前选中 widget id 列表（支持多选） */
  selectedIds: string[];
  /** 当前在 group 内聚焦的子 widget id；父 group 仍然保持选中态 */
  focusedChildId?: string;
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
  _removeWidget: (id: string) => void;
  _reorderWidget: (pageId: string, from: number, to: number) => void;
  _groupWidgets: (group: Extract<Widget, { type: 'group' }>, ids: string[]) => void;
  _ungroupWidget: (groupId: string) => void;
  _applyWidgetPatches: (patches: Record<string, Partial<Widget>>) => void;
  _applyGroupLayout: (
    groupId: string,
    layout: GroupLayout,
    childPatches: Record<string, Partial<Widget>>,
  ) => void;
  /** 还原被删除子树（供 RemoveWidgetCommand.undo 使用） */
  _restoreWidgets: (snapshot: RemoveSnapshot) => void;
  /** 清理已被 Canvas 消费的属性 patch */
  _clearWidgetPatches: (version: number) => void;
  /** 从历史关键帧完整恢复业务文档 */
  _restoreDocumentSnapshot: (snapshot: EditorDocumentSnapshot) => void;

  // ========================
  // actions（对外，走 history）
  // ========================
  addWidget: (widget: Widget) => void;
  updateWidget: (id: string, patch: Partial<Widget>, options?: PatchWidgetsCommandOptions) => void;
  updateWidgets: (
    patches: Record<string, Partial<Widget>>,
    options?: PatchWidgetsCommandOptions,
  ) => void;
  removeWidget: (id: string) => void;
  reorderWidget: (pageId: string, from: number, to: number) => void;
  groupWidgets: (group: Extract<Widget, { type: 'group' }>, ids: string[]) => void;
  ungroupWidget: (groupId: string) => void;
  applyGroupLayout: (groupId: string, layout: GroupLayout) => void;
  getGroupLayoutPatches: (groupId: string, layout: GroupLayout) => Record<string, Partial<Widget>>;

  // ui actions
  setActivePage: (pageId: string) => void;
  setSelectedIds: (ids: string[]) => void;
  setFocusedChildId: (id?: string) => void;
  setZoom: (zoom: number, mode?: ZoomMode) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setPageAspect: (aspect: CanvasAspect) => void;
}

export const useEditorStore: UseBoundStore<StoreApi<EditorState>> = create<EditorState>((set) => ({
  // document
  pages: PRESET_PAGES,
  widgets: PRESET_WIDGETS,
  rootIds: PRESET_ROOT_IDS,
  childIds: PRESET_CHILD_IDS,
  widgetPatches: {},
  widgetPatchVersion: 0,
  documentRevision: 0,

  // ui
  activePageId: PRESET_ACTIVE_PAGE_ID,
  selectedIds: [],
  focusedChildId: undefined,
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
      const focusedChildId =
        state.focusedChildId && toRemove.has(state.focusedChildId)
          ? undefined
          : state.focusedChildId;

      return {
        widgets,
        rootIds,
        childIds: cleanedChildIds,
        selectedIds,
        focusedChildId,
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

  _groupWidgets: (group, ids) =>
    set((state) => {
      const rootList = state.rootIds[group.pageId] ?? [];
      const idsSet = new Set(ids);
      const orderedIds = rootList.filter((id) => idsSet.has(id));
      if (orderedIds.length < 2) return state;

      const insertIndex = rootList.findIndex((id) => idsSet.has(id));
      if (insertIndex < 0) return state;

      const widgets = { ...state.widgets, [group.id]: group };
      orderedIds.forEach((id) => {
        const widget = widgets[id];
        if (!widget) return;
        widgets[id] = { ...widget, parentId: group.id } as Widget;
      });

      const nextRootIds = rootList.filter((id) => !idsSet.has(id));
      nextRootIds.splice(insertIndex, 0, group.id);

      return {
        widgets,
        rootIds: { ...state.rootIds, [group.pageId]: nextRootIds },
        childIds: { ...state.childIds, [group.id]: orderedIds },
        selectedIds: [group.id],
        focusedChildId: undefined,
      };
    }),

  _ungroupWidget: (groupId) =>
    set((state) => {
      const group = state.widgets[groupId];
      if (!group || group.type !== 'group') return state;

      const children = state.childIds[groupId] ?? group.childrenIds;
      const rootList = state.rootIds[group.pageId] ?? [];
      const groupIndex = rootList.indexOf(groupId);
      if (groupIndex < 0) return state;

      const widgets = { ...state.widgets };
      delete widgets[groupId];
      children.forEach((id) => {
        const widget = widgets[id];
        if (!widget) return;
        widgets[id] = { ...widget, parentId: null } as Widget;
      });

      const nextRootIds = rootList.filter((id) => id !== groupId);
      nextRootIds.splice(groupIndex, 0, ...children);

      const childIds = { ...state.childIds };
      delete childIds[groupId];

      return {
        widgets,
        rootIds: { ...state.rootIds, [group.pageId]: nextRootIds },
        childIds,
        selectedIds: children,
        focusedChildId: undefined,
      };
    }),

  _applyWidgetPatches: (patches) =>
    set((state) => {
      const entries = Object.entries(patches).filter(([id]) => !!state.widgets[id]);
      if (entries.length === 0) return state;

      const widgets = { ...state.widgets };
      const widgetPatches = { ...state.widgetPatches };
      entries.forEach(([id, patch]) => {
        widgets[id] = { ...widgets[id]!, ...patch } as Widget;
        widgetPatches[id] = {
          ...(widgetPatches[id] ?? {}),
          ...patch,
        };
      });

      return {
        widgets,
        widgetPatches,
        widgetPatchVersion: state.widgetPatchVersion + 1,
      };
    }),

  _applyGroupLayout: (groupId, layout, childPatches) =>
    set((state) => {
      const group = state.widgets[groupId];
      if (!group || group.type !== 'group') return state;

      const patches: Record<string, Partial<Widget>> = {
        [groupId]: { layout } as Partial<Widget>,
        ...childPatches,
      };
      const widgets = { ...state.widgets };
      const widgetPatches = { ...state.widgetPatches };
      Object.entries(patches).forEach(([id, patch]) => {
        const widget = widgets[id];
        if (!widget) return;
        widgets[id] = { ...widget, ...patch } as Widget;
        widgetPatches[id] = {
          ...(widgetPatches[id] ?? {}),
          ...patch,
        };
      });

      return {
        widgets,
        widgetPatches,
        widgetPatchVersion: state.widgetPatchVersion + 1,
      };
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

  _restoreDocumentSnapshot: (snapshot) =>
    set((state) => ({
      pages: structuredClone(snapshot.pages),
      widgets: structuredClone(snapshot.widgets),
      rootIds: structuredClone(snapshot.rootIds),
      childIds: structuredClone(snapshot.childIds),
      activePageId: snapshot.activePageId,
      selectedIds: [],
      focusedChildId: undefined,
      hoveredId: undefined,
      editingTextId: undefined,
      widgetPatches: {},
      widgetPatchVersion: state.widgetPatchVersion + 1,
      documentRevision: state.documentRevision + 1,
    })),

  // ========================
  // actions
  // ========================
  addWidget: (widget) => history.dispatch(new AddWidgetCommand(widget)),
  updateWidget: (id, patch, options) => {
    const changedPatch = getChangedPatch(useEditorStore.getState().widgets[id], patch);
    if (Object.keys(changedPatch).length === 0) return;
    history.dispatch(new PatchWidgetsCommand({ [id]: changedPatch }, options));
  },
  updateWidgets: (patches, options) => {
    const changedPatches = getChangedWidgetPatches(useEditorStore.getState().widgets, patches);
    if (Object.keys(changedPatches).length === 0) return;
    history.dispatch(new PatchWidgetsCommand(changedPatches, options));
  },
  removeWidget: (id) => history.dispatch(new RemoveWidgetCommand(id)),
  reorderWidget: (pageId, from, to) => history.dispatch(new ReorderWidgetCommand(pageId, from, to)),
  groupWidgets: (group, ids) => history.dispatch(new GroupWidgetsCommand(group, ids)),
  ungroupWidget: (groupId) => history.dispatch(new UngroupWidgetCommand(groupId)),
  applyGroupLayout: (groupId, layout) =>
    history.dispatch(new ApplyGroupLayoutCommand(groupId, layout)),
  getGroupLayoutPatches: (groupId, layout) => {
    const state = useEditorStore.getState();
    const group = state.widgets[groupId];
    if (!group || group.type !== 'group') return {};
    const children = (state.childIds[groupId] ?? group.childrenIds)
      .map((id) => state.widgets[id])
      .filter((widget): widget is Widget => !!widget);
    return computeGroupLayoutPatches(group, children, layout);
  },

  setActivePage: (pageId) =>
    set({ activePageId: pageId, selectedIds: [], focusedChildId: undefined }),
  setSelectedIds: (ids) =>
    set((state) => {
      const selectedId = ids[0];
      const focusedWidget = state.focusedChildId ? state.widgets[state.focusedChildId] : undefined;
      const shouldKeepFocusedChild =
        ids.length === 1 &&
        selectedId !== undefined &&
        focusedWidget?.parentId === selectedId &&
        state.widgets[selectedId]?.type === 'group';
      return {
        selectedIds: ids,
        focusedChildId: shouldKeepFocusedChild ? state.focusedChildId : undefined,
      };
    }),
  setFocusedChildId: (id) =>
    set((state) => {
      if (!id) return { focusedChildId: undefined };
      const widget = state.widgets[id];
      if (!widget?.parentId || state.selectedIds[0] !== widget.parentId) {
        return state;
      }
      return { focusedChildId: id };
    }),
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

export function captureEditorDocumentSnapshot(): EditorDocumentSnapshot {
  const state = useEditorStore.getState();
  return structuredClone({
    pages: state.pages,
    widgets: state.widgets,
    rootIds: state.rootIds,
    childIds: state.childIds,
    activePageId: state.activePageId,
  });
}

export function restoreEditorDocumentSnapshot(snapshot: EditorDocumentSnapshot): void {
  useEditorStore.getState()._restoreDocumentSnapshot(snapshot);
}

declare global {
  interface Window {
    __EDITOR_STORE__?: typeof useEditorStore;
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.__EDITOR_STORE__ = useEditorStore;
}
