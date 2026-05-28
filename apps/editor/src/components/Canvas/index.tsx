import { useEffect, useRef } from 'react';
import * as fabric from 'fabric';
import { useEditorStore } from '@/store';
import { applyWidgetPatch, widgetToFabric } from '@/core/canvas/widgetToFabric';
import { canvasEngine } from '@/core/engine';
import type { Widget } from '@/types/widget';
import styles from './style.module.scss';
const Canvas = () => {
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** fabric 实例（不放 store，避免引发渲染） */
  const fabricRef = useRef<fabric.Canvas | null>(null);
  /** 上一次渲染的 widget 快照，用于 diff */
  const lastWidgetsRef = useRef<Record<string, Widget>>({});

  const activePageId = useEditorStore((s) => s.activePageId);
  const page = useEditorStore((s) => s.pages[activePageId]);
  const pageWidth = page?.width;
  const pageHeight = page?.height;
  const pageBackground = page?.background;
  const widgets = useEditorStore((s) => s.widgets);
  const rootIds = useEditorStore((s) => s.rootIds[activePageId]);
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
  // TODO 全量操作
  // diff 渲染：widgets / rootIds 变化时同步到 fabric
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    console.log('Canvas useEffect', 'color:red;font-size:16px');

    const ids = rootIds ?? [];
    const idSet = new Set(ids);
    const lastWidgets = lastWidgetsRef.current;

    // 1. 删除已不存在的对象
    canvas.getObjects().forEach((obj) => {
      const oid = (obj as fabric.Object & { data?: { id?: string } }).data?.id;
      if (!oid) return;
      if (!idSet.has(oid) || !widgets[oid]) {
        canvas.remove(obj);
        canvasEngine.unregisterObject(oid);
      }
    });

    // 2. 新增 / 更新
    ids.forEach((id, index) => {
      const w = widgets[id];
      if (!w) return;

      const existing = canvasEngine.getObject(id);
      if (!existing) {
        // 新增
        const obj = widgetToFabric(w);
        if (!obj) return;
        canvas.add(obj);
        console.log('Canvas add object', 'color:green;font-size:16px', obj, id);
        canvasEngine.registerObject(id, obj);
      } else {
        // 更新：与上一次快照 diff，构造 patch
        const prev = lastWidgets[id];
        if (prev && prev !== w) {
          const patch: Record<string, unknown> = {};
          const prevRec = prev as unknown as Record<string, unknown>;
          const currRec = w as unknown as Record<string, unknown>;
          Object.keys(currRec).forEach((k) => {
            if (prevRec[k] !== currRec[k]) {
              patch[k] = currRec[k];
            }
          });
          if (Object.keys(patch).length > 0) {
            applyWidgetPatch(existing, w, patch as Partial<Widget>);
          }
        }
      }

      // 3. 调整层级（按 rootIds 顺序）
      const obj = canvasEngine.getObject(id);
      if (obj) {
        const currentIndex = canvas.getObjects().indexOf(obj);
        if (currentIndex !== index && currentIndex !== -1) {
          canvas.moveObjectTo(obj, index);
        }
      }
    });
    // 请求一次异步渲染
    canvas.requestRenderAll();
    lastWidgetsRef.current = widgets;
  }, [widgets, rootIds]);

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
      <canvas ref={canvasElRef} />
    </div>
  );
};

export default Canvas;
