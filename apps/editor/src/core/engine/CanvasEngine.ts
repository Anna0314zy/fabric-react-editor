import * as fabric from 'fabric';

/** 对齐方式 */
export type AlignType = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom';
export type AlignDelta = Record<string, { dx: number; dy: number }>;

/**
 * 画布视图引擎
 *
 * 唯一持有 fabric.Canvas 引用以及 widgetId -> fabric.Object 映射的地方，
 * 对外只暴露业务语义方法（select / bringToFront / align / exportPNG ...），
 * 避免 Command、UI、Shortcut 等上层模块直接依赖 fabric 细节。
 */
export class CanvasEngine {
  /** 全局唯一实例 */
  private static instance: CanvasEngine | null = null;

  private canvas: fabric.Canvas | null = null;
  private objectMap = new Map<string, fabric.Object>();

  /** 私有化构造函数，禁止外部 new，强制走 getInstance */
  private constructor() {}

  /** 获取全局唯一 CanvasEngine 实例 */
  static getInstance(): CanvasEngine {
    if (!CanvasEngine.instance) {
      CanvasEngine.instance = new CanvasEngine();
    }
    return CanvasEngine.instance;
  }

  // ========================
  // 生命周期（由 Canvas 组件调用）
  // ========================

  /** Canvas 组件初始化时挂载 fabric.Canvas */
  attach(canvas: fabric.Canvas): void {
    this.canvas = canvas;
    this.objectMap.clear();
  }

  /** Canvas 组件卸载时解绑 */
  detach(): void {
    this.canvas = null;
    this.objectMap.clear();
  }

  /** 注册 widgetId -> fabric.Object 映射 */
  registerObject(id: string, obj: fabric.Object): void {
    this.objectMap.set(id, obj);
  }

  /** 注销映射 */
  unregisterObject(id: string): void {
    this.objectMap.delete(id);
  }

  /** 是否已就绪 */
  get isReady(): boolean {
    return this.canvas !== null;
  }

  /** 受控访问 fabric 实例，仅供 Canvas 渲染层使用，业务方禁用 */
  getRawCanvas(): fabric.Canvas | null {
    return this.canvas;
  }

  /** 受控访问 fabric.Object，业务方优先使用上层方法 */
  getObject(id: string): fabric.Object | undefined {
    return this.objectMap.get(id);
  }

  // ========================
  // 选区
  // ========================

  /** 按 id 列表设置选中 */
  select(ids: string[]): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const objs = ids.map((id) => this.objectMap.get(id)).filter((o): o is fabric.Object => !!o);

    canvas.discardActiveObject();
    if (objs.length === 1) {
      const first = objs[0];
      if (first) canvas.setActiveObject(first);
    } else if (objs.length > 1) {
      const sel = new fabric.ActiveSelection(objs, { canvas });
      canvas.setActiveObject(sel);
    }
    canvas.requestRenderAll();
  }

  /** 清空选区 */
  clearSelection(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
  }

  // ========================
  // 层级（仅操作视图，持久化由 Command 写 store）
  // ========================

  bringToFront(ids: string[]): void {
    const canvas = this.canvas;
    if (!canvas) return;
    ids.forEach((id) => {
      const o = this.objectMap.get(id);
      if (o) canvas.bringObjectToFront(o);
    });
    canvas.requestRenderAll();
  }

  sendToBack(ids: string[]): void {
    const canvas = this.canvas;
    if (!canvas) return;
    ids.forEach((id) => {
      const o = this.objectMap.get(id);
      if (o) canvas.sendObjectToBack(o);
    });
    canvas.requestRenderAll();
  }

  // ========================
  // 几何
  // ========================

  /** 经过 fabric 矩阵变换后的真实包围盒（含旋转/缩放） */
  getBoundingBox(id: string): fabric.TBBox | null {
    return this.objectMap.get(id)?.getBoundingRect() ?? null;
  }

  /** 计算多目标对齐所需的画布坐标位移量。 */
  align(ids: string[], type: AlignType): AlignDelta {
    const targets = ids
      .map((id) => {
        const box = this.objectMap.get(id)?.getBoundingRect();
        return box ? { id, box } : null;
      })
      .filter((t): t is { id: string; box: fabric.TBBox } => !!t);

    if (targets.length < 2) return {};

    // 以所有目标的并集包围盒为对齐基准
    const minLeft = Math.min(...targets.map((t) => t.box.left));
    const minTop = Math.min(...targets.map((t) => t.box.top));
    const maxRight = Math.max(...targets.map((t) => t.box.left + t.box.width));
    const maxBottom = Math.max(...targets.map((t) => t.box.top + t.box.height));
    const centerX = (minLeft + maxRight) / 2;
    const centerY = (minTop + maxBottom) / 2;

    return targets.reduce<AlignDelta>((deltas, { id, box }) => {
      let dx = 0;
      let dy = 0;
      switch (type) {
        case 'left':
          dx = minLeft - box.left;
          break;
        case 'centerX':
          dx = centerX - (box.left + box.width / 2);
          break;
        case 'right':
          dx = maxRight - (box.left + box.width);
          break;
        case 'top':
          dy = minTop - box.top;
          break;
        case 'centerY':
          dy = centerY - (box.top + box.height / 2);
          break;
        case 'bottom':
          dy = maxBottom - (box.top + box.height);
          break;
      }
      deltas[id] = { dx, dy };
      return deltas;
    }, {});
  }

  // ========================
  // 导出
  // ========================

  exportPNG(options?: Parameters<fabric.Canvas['toDataURL']>[0]): string | null {
    return this.canvas?.toDataURL(options ?? { format: 'png', multiplier: 1 }) ?? null;
  }

  // ========================
  // 渲染
  // ========================

  requestRender(): void {
    this.canvas?.requestRenderAll();
  }
}

/** 全局单例：上层模块统一从这里拿 */
export const canvasEngine = CanvasEngine.getInstance();
