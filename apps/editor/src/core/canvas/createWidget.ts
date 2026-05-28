import type { PageData } from '@/types/page';
import type { Widget, WidgetType } from '@/types/widget';

/** 预设默认尺寸 */
const DEFAULT_SIZE: Record<string, { width: number; height: number }> = {
  rect: { width: 200, height: 120 },
  circle: { width: 160, height: 160 },
  text: { width: 320, height: 60 },
  'i-text': { width: 320, height: 60 },
};

/** 生成唯一 id：优先 crypto.randomUUID，回退 Math.random */
const genId = (prefix = 'w'): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
};

/**
 * 根据 widget 类型在画布中心生成默认 widget
 * 层级顺序完全由 store 中的 rootIds 数组顺序决定，无需在 widget 上携带 zIndex。
 */
export const createWidgetByType = (type: WidgetType, page: PageData): Widget | null => {
  const size = DEFAULT_SIZE[type];
  if (!size) return null;
  const left = Math.max(0, (page.width - size.width) / 2);
  const top = Math.max(0, (page.height - size.height) / 2);
  const id = genId(type === 'circle' ? 'w-cir' : type === 'rect' ? 'w-rect' : 'w-txt');

  const base = {
    id,
    name: type === 'rect' ? '矩形' : type === 'circle' ? '圆形' : type === 'text' ? '文本' : '文本',
    pageId: page.id,
    parentId: null,
    left,
    top,
    width: size.width,
    height: size.height,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
  } as const;

  switch (type) {
    case 'rect':
      return {
        ...base,
        type: 'rect',
        fill: '#1677ff',
        opacity: 1,
      };
    case 'circle':
      return {
        ...base,
        type: 'circle',
        fill: '#52c41a',
        opacity: 1,
      };
    case 'text':
      return {
        ...base,
        type: 'text',
        fill: '#222',
        text: '双击编辑文本',
        fontSize: 32,
        fontWeight: 'normal',
      };
    case 'i-text':
      return {
        ...base,
        type: 'i-text',
        fill: '#222',
        text: '双击编辑文本',
        fontSize: 32,
        fontWeight: 'normal',
      };
    default:
      return null;
  }
};
