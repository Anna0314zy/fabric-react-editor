import * as fabric from 'fabric';
import type { Widget } from '@/types/widget';

/**
 * 把 Widget 通用属性映射到 fabric.Object 选项
 * - originX/originY 默认 'left'/'top' 与 store 数据一致
 * - 通过 data 字段挂回 widgetId，便于反查
 */
const baseOptions = (w: Widget): fabric.TOptions<fabric.FabricObjectProps> => ({
  left: w.left,
  top: w.top,
  angle: w.angle,
  scaleX: w.scaleX,
  scaleY: w.scaleY,
  skewX: w.skewX ?? 0,
  skewY: w.skewY ?? 0,
  originX: w.originX ?? 'left',
  originY: w.originY ?? 'top',
  fill: w.fill,
  stroke: w.stroke,
  strokeWidth: w.strokeWidth ?? 0,
  opacity: w.opacity ?? 1,
  visible: w.visible ?? true,
  selectable: !w.locked,
  evented: !w.locked,
});

/**
 * 工厂：根据 Widget 类型创建对应 fabric.Object
 * 本期只覆盖 rect / circle / text，其余类型返回 null
 */
export const widgetToFabric = (w: Widget): fabric.Object | null => {
  const base = baseOptions(w);
  let obj: fabric.Object | null = null;

  switch (w.type) {
    case 'rect': {
      obj = new fabric.Rect({
        ...base,
        width: w.width,
        height: w.height,
      });
      break;
    }
    case 'circle': {
      // store 用 width/height，fabric.Circle 用 radius
      const radius = Math.min(w.width, w.height) / 2;
      obj = new fabric.Circle({
        ...base,
        radius,
      });
      break;
    }
    case 'text':
    case 'i-text': {
      obj = new fabric.Textbox(w.text, {
        ...base,
        width: w.width,
        fontFamily: w.fontFamily ?? 'sans-serif',
        fontSize: w.fontSize ?? 16,
        fontWeight: w.fontWeight ?? 'normal',
        fontStyle: w.fontStyle ?? 'normal',
        textAlign: w.textAlign ?? 'left',
        lineHeight: w.lineHeight ?? 1.16,
        underline: w.underline ?? false,
      });
      break;
    }
    default:
      // 本期未覆盖：triangle / polygon / image / svg / line / arrow / path / group
      return null;
  }

  // 把 widgetId 挂到 fabric 对象上，便于事件回写
  obj.set({ data: { id: w.id } });
  return obj;
};

/**
 * 把 widget 局部变更同步到既有 fabric 对象
 * 注：circle 的 radius 由 width/height 派生
 */
export const applyWidgetPatch = (
  obj: fabric.Object,
  widget: Widget,
  patch: Partial<Widget>,
): void => {
  // 把 patch 中的通用属性直接 set
  const generic: Record<string, unknown> = {};
  const passthrough: (keyof Widget)[] = [
    'left',
    'top',
    'angle',
    'scaleX',
    'scaleY',
    'skewX',
    'skewY',
    'originX',
    'originY',
    'fill',
    'stroke',
    'strokeWidth',
    'opacity',
    'visible',
  ];
  passthrough.forEach((k) => {
    if (k in patch) {
      generic[k] = (patch as Record<string, unknown>)[k as string];
    }
  });
  if ('locked' in patch) {
    generic.selectable = !widget.locked;
    generic.evented = !widget.locked;
  }

  // 几何
  if ('width' in patch || 'height' in patch) {
    if (widget.type === 'circle') {
      generic.radius = Math.min(widget.width, widget.height) / 2;
    } else {
      if ('width' in patch) generic.width = patch.width;
      if ('height' in patch) generic.height = patch.height;
    }
  }

  // 文本
  if (widget.type === 'text' || widget.type === 'i-text') {
    const tp = patch as Partial<Extract<Widget, { type: 'text' | 'i-text' }>>;
    if ('text' in tp) generic.text = tp.text;
    if ('fontFamily' in tp) generic.fontFamily = tp.fontFamily;
    if ('fontSize' in tp) generic.fontSize = tp.fontSize;
    if ('fontWeight' in tp) generic.fontWeight = tp.fontWeight;
    if ('fontStyle' in tp) generic.fontStyle = tp.fontStyle;
    if ('textAlign' in tp) generic.textAlign = tp.textAlign;
    if ('lineHeight' in tp) generic.lineHeight = tp.lineHeight;
    if ('underline' in tp) generic.underline = tp.underline;
  }
  console.log('Canvas update object', 'color:blue;font-size:16px', `${generic}`);

  obj.set(generic);
  // 重新计算对象控制点 / 边界盒 / 命中区域
  obj.setCoords();
};
