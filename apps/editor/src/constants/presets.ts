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

/** 页面 2：编组演示（group 虚拟节点 + 2 个子节点） */
const page2Widgets: Widget[] = [
  {
    id: 'g-1',
    type: 'group',
    name: '按钮组',
    pageId: 'p-2',
    parentId: null,
    left: 200,
    top: 200,
    width: 240,
    height: 80,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    childrenIds: ['w-btn-bg', 'w-btn-text'],
  },
  {
    id: 'w-btn-bg',
    type: 'rect',
    name: '按钮底',
    pageId: 'p-2',
    parentId: 'g-1',
    left: 200,
    top: 200,
    width: 240,
    height: 80,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    fill: '#1677ff',
  },
  {
    id: 'w-btn-text',
    type: 'text',
    name: '按钮文字',
    pageId: 'p-2',
    parentId: 'g-1',
    left: 260,
    top: 222,
    width: 120,
    height: 36,
    angle: 0,
    scaleX: 1,
    scaleY: 1,
    text: 'Click Me',
    fill: '#fff',
    fontSize: 24,
  },
];

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
export const PRESET_WIDGETS: Record<string, Widget> = toRecord([...page1Widgets, ...page2Widgets]);

/** 预设 pageId -> 根层级 widget id 列表 */
export const PRESET_ROOT_IDS: Record<string, string[]> = {
  'p-1': ['w-rect-1', 'w-circle-1', 'w-text-1'],
  'p-2': ['g-1'],
};

/** 预设 groupId -> 子 widget id 列表 */
export const PRESET_CHILD_IDS: Record<string, string[]> = {
  'g-1': ['w-btn-bg', 'w-btn-text'],
};

/** 预设激活页面 id */
export const PRESET_ACTIVE_PAGE_ID = 'p-1';
