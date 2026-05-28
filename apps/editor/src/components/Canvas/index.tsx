import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '@/store';
import { applyWidgetPatch, widgetToFabric } from '@/core/canvas/widgetToFabric';
import { canvasEngine } from '@/core/engine';
import type { Widget } from '@/types/widget';
import styles from './style.module.scss';

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

  const activePageId = useEditorStore((s) => s.activePageId);
  const page = useEditorStore((s) => s.pages[activePageId]);
  const pageWidth = page?.width;
  const pageHeight = page?.height;
  const pageBackground = page?.background;
  const zoom = useEditorStore((s) => s.zoom);
  const zoomMode = useEditorStore((s) => s.zoomMode);
  const rootIds = useEditorStore((s) => s.rootIds[activePageId]);
  const widgetPatchVersion = useEditorStore((s) => s.widgetPatchVersion);
  const selectedIds = useEditorStore((s) => s.selectedIds);
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
    });
    fabricRef.current = canvas;

    // 挂到 engine，外部统一通过 canvasEngine 操作画布视图
    canvasEngine.attach(canvas);

    // 选中事件 → 同步 selectedIds
    const pickIds = (): string[] => {
      const objs = canvas.getActiveObjects();
      return objs
        .map((o) => (o as fabric.Object & { data?: { id?: string } }).data?.id)
        .filter((id): id is string => typeof id === 'string');
    };
    const isSameSelection = (next: string[]) => {
      const current = useEditorStore.getState().selectedIds;
      return current.length === next.length && current.every((id, index) => id === next[index]);
    };
    const handleSelection = () => {
      const ids = pickIds();
      if (!isSameSelection(ids)) {
        useEditorStore.getState().setSelectedIds(ids);
      }
    };
    const handleClear = () => {
      if (!isSameSelection([])) {
        useEditorStore.getState().setSelectedIds([]);
      }
    };
    // 对象被 fabric 自身修改后（拖拽 / 缩放 / 旋转）回写 widget
    const handleModified = (e: { target?: fabric.Object }) => {
      const obj = e.target;
      if (!obj) return;
      const id = (obj as fabric.Object & { data?: { id?: string } }).data?.id;
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
    canvas.on('object:modified', handleModified);

    return () => {
      canvas.off('selection:created', handleSelection);
      canvas.off('selection:updated', handleSelection);
      canvas.off('selection:cleared', handleClear);
      canvas.off('object:modified', handleModified);
      canvas.dispose();
      fabricRef.current = null;
      canvasEngine.detach();
      lastWidgetsRef.current = {};
      rootIdsRef.current = [];
    };
    // 仅在切换页面（id 变化）时重建
  }, [activePageId]);

  // 同步画布尺寸（不重建 canvas）
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !pageWidth || !pageHeight) return;
    canvas.setDimensions({ width: pageWidth, height: pageHeight });
    canvas.requestRenderAll();
  }, [pageWidth, pageHeight]);

  // 同步页面背景色（不重建 canvas）
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !pageBackground) return;
    canvas.backgroundColor = pageBackground;
    canvas.requestRenderAll();
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

    const ids = rootIds ?? [];
    const idSet = new Set(ids);
    const currentWidgets = useEditorStore.getState().widgets;
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
          obj = widgetToFabric(w) ?? undefined;
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
      canvas.requestRenderAll();
    }
    rootIdsRef.current = ids;
  }, [rootIds]);

  // 属性同步：只消费 store 记录的 patch，避免每次属性变化都扫描当前页所有对象。
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    let changed = false;
    const state = useEditorStore.getState();
    const { widgetPatches, widgets } = state;

    Object.entries(widgetPatches).forEach(([id, patch]) => {
      const w = widgets[id];
      const obj = canvasEngine.getObject(id);
      if (!w || !obj) return;

      if (Object.keys(patch).length > 0) {
        applyWidgetPatch(obj, w, patch);
        changed = true;
      }
      lastWidgetsRef.current[id] = w;
    });

    if (changed) {
      canvas.requestRenderAll();
    }
    state._clearWidgetPatches(widgetPatchVersion);
  }, [widgetPatchVersion]);

  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const activeIds = canvas
      .getActiveObjects()
      .map((o) => (o as fabric.Object & { data?: { id?: string } }).data?.id)
      .filter((id): id is string => typeof id === 'string');
    const isSame =
      activeIds.length === selectedIds.length &&
      activeIds.every((id, index) => id === selectedIds[index]);
    if (isSame) return;
    canvasEngine.select(selectedIds);
  }, [selectedIds]);

  return (
    <div className={styles.container} ref={containerRef}>
      {pageWidth && pageHeight ? (
        <div
          className={styles.viewport}
          style={{
            '--page-width': `${pageWidth}px`,
            '--page-height': `${pageHeight}px`,
            '--zoom': zoom,
          }}
        >
          <div className={styles.stage}>
            <canvas ref={canvasElRef} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Canvas;
