import { useEffect, useRef, type CSSProperties } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '@/store';
import { contextMenu, useContextMenuStore } from '@/store/contextMenu';
import { applyWidgetPatch } from '@/core/canvas/widgetToFabric';
import { widgetTreeToFabric } from '@/core/canvas/widgetTreeToFabric';
import { canvasEngine } from '@/core/engine';
import { getRootWidgetId } from '@/core/widget/tree';
import { CanvasFloatingMenu } from '@/components/CanvasFloatingMenu';
import { useFloatingMenuVisibility } from '@/components/CanvasFloatingMenu/useFloatingMenuVisibility';
import type { Widget } from '@/types/widget';
import styles from './style.module.scss';

type FabricObjectWithData = fabric.Object & {
  data?: { id?: string; helper?: string };
};

const CHILD_FOCUS_HELPER = 'group-child-focus';

function getFabricId(obj: fabric.Object | undefined): string | undefined {
  return (obj as FabricObjectWithData | undefined)?.data?.id;
}

function pickSubTargetId(
  event: { target?: fabric.Object; subTargets?: fabric.Object[] },
  widgets: Record<string, Widget>,
): { rootId: string; childId: string } | null {
  const targetId = getFabricId(event.target);
  const hitIds = [targetId, ...(event.subTargets ?? []).map(getFabricId)].filter(
    (id): id is string => !!id,
  );
  const childId = hitIds.find((id) => widgets[id]?.parentId !== null);
  if (!childId) return null;

  const rootId = getRootWidgetId(childId, widgets);
  if (!rootId || widgets[rootId]?.type !== 'group') return null;
  return { rootId, childId };
}

function getWidgetCanvasBoundingBox(widget: Widget): fabric.TBBox {
  const width = widget.width * (widget.scaleX ?? 1);
  const height = widget.height * (widget.scaleY ?? 1);
  const rad = fabric.util.degreesToRadians(widget.angle ?? 0);
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height },
  ].map((point) => ({
    x: widget.left + point.x * cos - point.y * sin,
    y: widget.top + point.x * sin + point.y * cos,
  }));
  const left = Math.min(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const right = Math.max(...points.map((point) => point.x));
  const bottom = Math.max(...points.map((point) => point.y));
  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

type FabricPointerEvent = {
  e: MouseEvent;
  target?: fabric.Object;
  subTargets?: fabric.Object[];
};

/**
 * 批量修改 Fabric 对象时临时关闭自动渲染，避免 add/remove/reorder 连续触发重绘。
 *
 * @param canvas 当前 Fabric canvas 实例。
 * @param task 需要批量执行的画布结构操作。
 */
function batchCanvasMutation(canvas: fabric.Canvas, task: () => void): void {
  const prevRenderOnAddRemove = canvas.renderOnAddRemove;
  canvas.renderOnAddRemove = false;
  try {
    task();
  } finally {
    canvas.renderOnAddRemove = prevRenderOnAddRemove;
  }
}

const Canvas = () => {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** fabric 实例（不放 store，避免引发渲染） */
  const fabricRef = useRef<fabric.Canvas | null>(null);
  /** 上一次渲染的 widget 快照，用于 diff */
  const lastWidgetsRef = useRef<Record<string, Widget>>({});
  /** 当前页面根节点 id 快照，用于把结构同步和属性同步拆开 */
  const rootIdsRef = useRef<string[]>([]);
  /** 最近一次完成全量恢复的文档版本 */
  const documentRevisionRef = useRef(0);
  /** 组内子元素聚焦辅助框，不进 store、不参与导出 */
  const childFocusRectRef = useRef<fabric.Rect | null>(null);
  const isContextMenuOpen = useContextMenuStore((state) => state.open);
  const {
    hidden: isFloatingMenuHidden,
    show: showFloatingMenu,
    hide: hideFloatingMenu,
    reset: resetFloatingMenu,
  } = useFloatingMenuVisibility();

  const activePageId = useEditorStore((s) => s.activePageId);
  const page = useEditorStore((s) => s.pages[activePageId]);
  const pageWidth = page?.width;
  const pageHeight = page?.height;
  const pageBackground = page?.background;
  const zoom = useEditorStore((s) => s.zoom);
  const zoomMode = useEditorStore((s) => s.zoomMode);
  const rootIds = useEditorStore((s) => s.rootIds[activePageId]);
  const widgetPatchVersion = useEditorStore((s) => s.widgetPatchVersion);
  const documentRevision = useEditorStore((s) => s.documentRevision);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const focusedChildId = useEditorStore((s) => s.focusedChildId);
  /**
   * 1. 删除不存在对象
2. 创建新增对象
3. patch 更新已有对象
4. 按 rootIds 重排 z-index
5. render
   */
  // 初始化 / 销毁 fabric.Canvas
  useEffect(() => {
    const currentPage = useEditorStore.getState().pages[activePageId];
    if (!canvasElRef.current || !currentPage) return;
    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: currentPage.width,
      height: currentPage.height,
      backgroundColor: currentPage.background,
      preserveObjectStacking: true,
      fireRightClick: true,
      stopContextMenu: true,
    });
    fabricRef.current = canvas;

    // 挂到 engine，外部统一通过 canvasEngine 操作画布视图
    canvasEngine.attach(canvas);

    // 选中事件 → 同步 selectedIds
    const pickIds = (): string[] => {
      const objs = canvas.getActiveObjects();
      return objs.map(getFabricId).filter((id): id is string => typeof id === 'string');
    };
    const isSameSelection = (next: string[]) => {
      const current = useEditorStore.getState().selectedIds;
      return current.length === next.length && current.every((id, index) => id === next[index]);
    };
    const handleSelection = () => {
      const ids = pickIds();
      showFloatingMenu();
      if (!isSameSelection(ids)) {
        useEditorStore.getState().setSelectedIds(ids);
      }
    };
    const handleClear = () => {
      showFloatingMenu();
      if (!isSameSelection([])) {
        useEditorStore.getState().setSelectedIds([]);
      }
    };
    const handleTransforming = () => {
      hideFloatingMenu();
      const helper = childFocusRectRef.current;
      if (helper) {
        canvas.remove(helper);
        childFocusRectRef.current = null;
      }
    };
    const handleMouseDown = (event: { target?: fabric.Object; subTargets?: fabric.Object[] }) => {
      const state = useEditorStore.getState();
      const subTarget = pickSubTargetId(event, state.widgets);
      if (subTarget) {
        const { selectedIds: currentSelectedIds } = state;
        const isSameGroupSelection =
          currentSelectedIds.length === 1 && currentSelectedIds[0] === subTarget.rootId;
        if (!isSameGroupSelection) {
          state.setSelectedIds([subTarget.rootId]);
        }
        useEditorStore.getState().setFocusedChildId(subTarget.childId);
        showFloatingMenu();
        return;
      }

      const targetId = getFabricId(event.target);
      if (!targetId || state.widgets[targetId]?.type === 'group') {
        state.setFocusedChildId(undefined);
      }
    };
    const handleContextMenu = (event: FabricPointerEvent) => {
      hideFloatingMenu();
      const state = useEditorStore.getState();
      const subTarget = pickSubTargetId(event, state.widgets);
      const targetId = subTarget?.childId ?? getFabricId(event.target);
      const selectedRootId = subTarget?.rootId ?? targetId;

      if (selectedRootId && state.widgets[selectedRootId]) {
        const alreadySelected = state.selectedIds.includes(selectedRootId);
        if (!alreadySelected) {
          state.setSelectedIds([selectedRootId]);
        }
        state.setFocusedChildId(subTarget?.childId);
      } else {
        state.setSelectedIds([]);
        state.setFocusedChildId(undefined);
        canvas.discardActiveObject();
        canvasEngine.requestRender();
      }

      const pointer = canvas.getScenePoint(event.e);
      contextMenu.open({
        x: event.e.clientX,
        y: event.e.clientY,
        source: 'canvas',
        canvasPoint: { x: pointer.x, y: pointer.y },
        targetId,
      });
    };
    const handleMouseDownBefore = (event: { e: Event }) => {
      if (event.e instanceof MouseEvent && event.e.button !== 2) {
        contextMenu.close();
      }
    };
    const handleMouseUp = (event: {
      e: Event;
      target?: fabric.Object;
      subTargets?: fabric.Object[];
    }) => {
      if (event.e instanceof MouseEvent && event.e.button === 2) {
        handleContextMenu(event as FabricPointerEvent);
      }
    };
    // 对象被 fabric 自身修改后（拖拽 / 缩放 / 旋转）回写 widget
    const handleModified = (e: { target?: fabric.Object }) => {
      showFloatingMenu();
      const obj = e.target;
      if (!obj) return;
      const id = getFabricId(obj);
      if (!id) return;
      useEditorStore.getState().updateWidget(id, {
        left: obj.left ?? 0,
        top: obj.top ?? 0,
        angle: obj.angle ?? 0,
        scaleX: obj.scaleX ?? 1,
        scaleY: obj.scaleY ?? 1,
      });
    };
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', handleClear);
    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:down:before', handleMouseDownBefore);
    canvas.on('mouse:up', handleMouseUp);
    canvas.on('object:moving', handleTransforming);
    canvas.on('object:scaling', handleTransforming);
    canvas.on('object:rotating', handleTransforming);
    canvas.on('object:modified', handleModified);

    return () => {
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleClear);
      canvas.off('mouse:down', handleMouseDown);
      canvas.off('mouse:down:before', handleMouseDownBefore);
      canvas.off('mouse:up', handleMouseUp);
      canvas.off('object:moving', handleTransforming);
      canvas.off('object:scaling', handleTransforming);
      canvas.off('object:rotating', handleTransforming);
      canvas.off('object:modified', handleModified);
      canvas.dispose();
      childFocusRectRef.current = null;
      fabricRef.current = null;
      contextMenu.close();
      resetFloatingMenu();
      canvasEngine.detach();
      lastWidgetsRef.current = {};
      rootIdsRef.current = [];
    };
    // 仅在切换页面（id 变化）时重建
  }, [activePageId, hideFloatingMenu, resetFloatingMenu, showFloatingMenu]);

  // 同步画布尺寸（不重建 canvas）
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !pageWidth || !pageHeight) return;
    canvas.setDimensions({ width: pageWidth, height: pageHeight });
    canvasEngine.requestRender();
  }, [pageWidth, pageHeight]);

  // 同步页面背景色（不重建 canvas）
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !pageBackground) return;
    canvas.backgroundColor = pageBackground;
    canvasEngine.requestRender();
  }, [pageBackground]);

  // fit 模式：根据中间容器尺寸自动计算显示缩放，窗口变化时同步适配。
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pageWidth || !pageHeight || zoomMode !== 'fit') return;

    const fit = () => {
      const padding = 64;
      const availableWidth = Math.max(1, container.clientWidth - padding);
      const availableHeight = Math.max(1, container.clientHeight - padding);
      const nextZoom = Math.min(1, availableWidth / pageWidth, availableHeight / pageHeight);
      useEditorStore.getState().setZoom(nextZoom, 'fit');
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [pageHeight, pageWidth, zoomMode]);

  // 结构同步：只在根层级变化时处理新增、删除和 z-index。
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (documentRevision !== documentRevisionRef.current) return;

    const ids = rootIds ?? [];
    const idSet = new Set(ids);
    const currentState = useEditorStore.getState();
    const currentWidgets = currentState.widgets;
    const currentChildIds = currentState.childIds;
    const prevRootIds = rootIdsRef.current;
    const orderChanged =
      prevRootIds.length !== ids.length || prevRootIds.some((id, index) => id !== ids[index]);
    let structuralChanged = false;

    batchCanvasMutation(canvas, () => {
      canvas.getObjects().forEach((obj) => {
        const oid = (obj as fabric.Object & { data?: { id?: string } }).data?.id;
        if (!oid) return;
        if (!idSet.has(oid) || !currentWidgets[oid]) {
          canvas.remove(obj);
          canvasEngine.unregisterObject(oid);
          delete lastWidgetsRef.current[oid];
          structuralChanged = true;
        }
      });

      const orderedObjects: fabric.Object[] = [];
      ids.forEach((id) => {
        const w = currentWidgets[id];
        if (!w) return;

        let obj = canvasEngine.getObject(id);
        if (!obj) {
          obj = widgetTreeToFabric(w, currentWidgets, currentChildIds) ?? undefined;
          if (!obj) return;
          canvas.add(obj);
          canvasEngine.registerObject(id, obj);
          lastWidgetsRef.current[id] = w;
          structuralChanged = true;
        }

        orderedObjects.push(obj);
      });

      if (orderChanged) {
        orderedObjects.forEach((obj, index) => {
          canvas.moveObjectTo(obj, index);
        });
        structuralChanged = true;
      }
    });

    if (structuralChanged) {
      canvasEngine.requestRender();
    }
    rootIdsRef.current = ids;
  }, [documentRevision, rootIds]);

  // 属性同步：只消费 store 记录的 patch，避免每次属性变化都扫描当前页所有对象。
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (documentRevision !== documentRevisionRef.current) return;

    let changed = false;
    const state = useEditorStore.getState();
    const { childIds, widgetPatches, widgets } = state;
    const rootIdsSet = new Set(rootIds ?? []);
    const rootsToRebuild = new Set<string>();
    const patchEntries = Object.entries(widgetPatches);

    if (patchEntries.length > 0) {
      canvas.discardActiveObject();
    }

    patchEntries.forEach(([id, patch]) => {
      const w = widgets[id];
      const obj = canvasEngine.getObject(id);
      if (!w) return;

      const rootId = getRootWidgetId(id, widgets);
      const rootWidget = rootId ? widgets[rootId] : undefined;
      if (rootId && rootWidget?.type === 'group' && rootIdsSet.has(rootId)) {
        rootsToRebuild.add(rootId);
        return;
      }

      if (!obj) return;

      if (Object.keys(patch).length > 0) {
        applyWidgetPatch(obj, w, patch);
        changed = true;
      }
      lastWidgetsRef.current[id] = w;
    });

    rootsToRebuild.forEach((rootId) => {
      const previous = canvasEngine.getObject(rootId);
      const widget = widgets[rootId];
      if (!previous || !widget) return;
      const index = canvas.getObjects().indexOf(previous);
      canvas.remove(previous);
      canvasEngine.unregisterObject(rootId);

      const next = widgetTreeToFabric(widget, widgets, childIds);
      if (!next) return;
      canvas.add(next);
      canvasEngine.registerObject(rootId, next);
      canvas.moveObjectTo(next, Math.max(0, index));
      lastWidgetsRef.current[rootId] = widget;
      changed = true;
    });

    if (changed) {
      canvasEngine.select(selectedIds);
    }
    state._clearWidgetPatches(widgetPatchVersion);
  }, [documentRevision, rootIds, selectedIds, widgetPatchVersion]);

  // 关键帧恢复会整体替换文档数据；此时跳过增量 diff，按最终 Store 状态重建一次。
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || documentRevision === documentRevisionRef.current) return;

    const state = useEditorStore.getState();
    const ids = state.rootIds[state.activePageId] ?? [];
    const objects = canvas.getObjects();

    batchCanvasMutation(canvas, () => {
      canvas.discardActiveObject();
      if (objects.length > 0) {
        canvas.remove(...objects);
      }
      canvasEngine.clearObjectRegistry();
      lastWidgetsRef.current = {};

      ids.forEach((id) => {
        const widget = state.widgets[id];
        if (!widget) return;
        const object = widgetTreeToFabric(widget, state.widgets, state.childIds);
        if (!object) return;
        canvas.add(object);
        canvasEngine.registerObject(id, object);
        lastWidgetsRef.current[id] = widget;
      });
    });

    childFocusRectRef.current = null;
    rootIdsRef.current = ids;
    documentRevisionRef.current = documentRevision;
    canvasEngine.select(state.selectedIds);
    canvasEngine.requestRender();
  }, [documentRevision]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeIds = canvas
      .getActiveObjects()
      .map(getFabricId)
      .filter((id): id is string => typeof id === 'string');
    const isSame =
      activeIds.length === selectedIds.length &&
      activeIds.every((id, index) => id === selectedIds[index]);
    if (isSame) return;
    canvasEngine.select(selectedIds);
  }, [selectedIds]);

  useEffect(() => {
    const canvas = fabricRef.current;
    const clearFocusRect = () => {
      const previous = childFocusRectRef.current;
      if (!previous || !canvas) return;
      canvas.remove(previous);
      childFocusRectRef.current = null;
    };

    if (!canvas || !focusedChildId || selectedIds.length !== 1) {
      clearFocusRect();
      canvasEngine.requestRender();
      return;
    }

    const state = useEditorStore.getState();
    const widget = state.widgets[focusedChildId];
    const rootId = widget ? getRootWidgetId(widget.id, state.widgets) : null;
    if (!widget || rootId !== selectedIds[0]) {
      clearFocusRect();
      canvasEngine.requestRender();
      return;
    }

    const box = getWidgetCanvasBoundingBox(widget);
    let helper = childFocusRectRef.current;
    if (!helper) {
      helper = new fabric.Rect({
        fill: 'transparent',
        stroke: '#1677ff',
        strokeWidth: 1,
        strokeDashArray: [4, 2],
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
      });
      helper.set({ data: { helper: CHILD_FOCUS_HELPER } });
      childFocusRectRef.current = helper;
      canvas.add(helper);
    }

    helper.set({
      left: box.left,
      top: box.top,
      width: box.width,
      height: box.height,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
    });
    helper.setCoords();
    canvas.bringObjectToFront(helper);
    canvasEngine.requestRender();
  }, [focusedChildId, selectedIds, widgetPatchVersion]);

  const viewportStyle = {
    '--page-width': `${pageWidth}px`,
    '--page-height': `${pageHeight}px`,
    '--zoom': zoom,
  } as CSSProperties;

  return (
    <div className={styles.container} ref={containerRef}>
      {pageWidth && pageHeight ? (
        <div className={styles.viewport} style={viewportStyle}>
          <div className={styles.stage}>
            <canvas ref={canvasElRef} />
          </div>
        </div>
      ) : null}
      <CanvasFloatingMenu
        containerRef={containerRef}
        getCanvas={() => fabricRef.current}
        hidden={isFloatingMenuHidden || isContextMenuOpen}
      />
    </div>
  );
};

export default Canvas;
