import type { PageData } from '../types/page';
import type { Widget } from '../types/widget';

/** 默认画布尺寸（16:9） */
export const DEFAULT_CANVAS = {
  width: 1280,
  height: 720,
  background: '#ffffff',
} as const;

/** 页面 1：基础图形 + 文本 */
const page1Widgets: Widget[] = [
  {
    id: 'w-rect-1',
    type: 'rect',
    name: '矩形',
    pageId: 'p-1',
    parentId: null,
    left: 120,
    top: 100,
    width: 240,
    height: 160,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    fill: '#1677ff',
    opacity: 1,
  },
  {
    id: 'w-circle-1',
    type: 'circle',
    name: '圆形',
    pageId: 'p-1',
    parentId: null,
    left: 480,
    top: 120,
    width: 160,
    height: 160,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    fill: '#52c41a',
  },
  {
    id: 'w-text-1',
    type: 'text',
    name: '标题',
    pageId: 'p-1',
    parentId: null,
    left: 120,
    top: 320,
    width: 520,
    height: 60,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    fill: '#222',
    text: 'Hello Fabric Editor',
    fontSize: 36,
    fontWeight: 'bold',
  },
];

const STRESS_WIDGET_COUNT = 500;
const STRESS_COLS = 25;
const STRESS_CELL_WIDTH = 46;
const STRESS_CELL_HEIGHT = 30;
const STRESS_START_LEFT = 48;
const STRESS_START_TOP = 420;
const STRESS_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];

/** 页面 1：性能测试对象，用于观察 500+ 元素时的同步与渲染瓶颈 */
const stressWidgets: Widget[] = Array.from({ length: STRESS_WIDGET_COUNT }, (_, index) => {
  const col = index % STRESS_COLS;
  const row = Math.floor(index / STRESS_COLS);
  const left = STRESS_START_LEFT + col * STRESS_CELL_WIDTH;
  const top = STRESS_START_TOP + row * STRESS_CELL_HEIGHT;
  const color = STRESS_COLORS[index % STRESS_COLORS.length]!;

  if (index % 20 === 0) {
    return {
      id: `w-stress-text-${index}`,
      type: 'text',
      name: `性能文本 ${index + 1}`,
      pageId: 'p-1',
      parentId: null,
      left,
      top,
      width: 72,
      height: 22,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      fill: '#222',
      text: `${index + 1}`,
      fontSize: 14,
      fontWeight: 'normal',
    };
  }

  if (index % 3 === 0) {
    return {
      id: `w-stress-circle-${index}`,
      type: 'circle',
      name: `性能圆形 ${index + 1}`,
      pageId: 'p-1',
      parentId: null,
      left,
      top,
      width: 18,
      height: 18,
      angle: 0,
      scaleX: 1,
      scaleY: 1,
      fill: color,
      opacity: 0.9,
    };
  }

  return {
    id: `w-stress-rect-${index}`,
    type: 'rect',
    name: `性能矩形 ${index + 1}`,
    pageId: 'p-1',
    parentId: null,
    left,
    top,
    width: 28,
    height: 18,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    fill: color,
    opacity: 0.9,
  };
});

/** 数组 -> Record<id, Widget> */
const toRecord = (list: Widget[]): Record<string, Widget> =>
  list.reduce<Record<string, Widget>>((acc, w) => {
    acc[w.id] = w;
    return acc;
  }, {});

/** 预设页面字典：pageId -> 页面元信息 */
export const PRESET_PAGES: Record<string, PageData> = {
  'p-1': { id: 'p-1', name: '页面 1', ...DEFAULT_CANVAS },
  'p-2': { id: 'p-2', name: '页面 2（编组演示）', ...DEFAULT_CANVAS },
};

/** 预设所有 widget 的扁平池 */
export const PRESET_WIDGETS: Record<string, Widget> = toRecord([
  ...page1Widgets,
  // ...stressWidgets,
]);

/** 预设 pageId -> 根层级 widget id 列表 */
export const PRESET_ROOT_IDS: Record<string, string[]> = {
  'p-1': [...page1Widgets.map((w) => w.id)],
  'p-2': ['g-1'],
};

/** 预设 groupId -> 子 widget id 列表 */
export const PRESET_CHILD_IDS: Record<string, string[]> = {};

/** 预设激活页面 id */
export const PRESET_ACTIVE_PAGE_ID = 'p-1';
