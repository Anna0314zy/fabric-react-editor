import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  AppstoreOutlined,
  BorderOutlined,
  BoldOutlined,
  DeleteOutlined,
  FontSizeOutlined,
  ItalicOutlined,
  LockOutlined,
  PlusCircleOutlined,
  UnlockOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import type { Widget, WidgetType } from '@/types/widget';
import { contextMenuRegistry } from './ContextMenuRegistry';
import type { ContextMenuDefinition } from './types';

let registered = false;

const SHAPE_TYPES = new Set<WidgetType>(['rect', 'circle', 'triangle', 'polygon']);
const FILL_COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2', '#222222'];

function isTextWidget(widget?: Widget): widget is Extract<Widget, { type: 'text' | 'i-text' }> {
  return widget?.type === 'text' || widget?.type === 'i-text';
}

function isFillEditableWidget(widget?: Widget): widget is Exclude<Widget, { type: 'group' }> {
  return !!widget && widget.type !== 'group';
}

const createItems: ContextMenuDefinition[] = [
  {
    key: 'canvas.addRect',
    label: '添加矩形',
    group: 'create',
    icon: <PlusCircleOutlined />,
    commandId: 'canvas.addWidget',
    commandArgs: (ctx) => ({ type: 'rect', page: ctx.page, canvasPoint: ctx.canvasPoint }),
  },
  {
    key: 'canvas.addCircle',
    label: '添加圆形',
    group: 'create',
    icon: <PlusCircleOutlined />,
    commandId: 'canvas.addWidget',
    commandArgs: (ctx) => ({ type: 'circle', page: ctx.page, canvasPoint: ctx.canvasPoint }),
  },
  {
    key: 'canvas.addText',
    label: '添加文本',
    group: 'create',
    icon: <FontSizeOutlined />,
    commandId: 'canvas.addWidget',
    commandArgs: (ctx) => ({ type: 'text', page: ctx.page, canvasPoint: ctx.canvasPoint }),
  },
];

const alignItems: ContextMenuDefinition[] = [
  {
    key: 'widget.alignLeft',
    label: '左对齐',
    group: 'align',
    icon: <AlignLeftOutlined />,
    commandId: 'widget.alignLeft',
  },
  {
    key: 'widget.alignCenterX',
    label: '水平居中',
    group: 'align',
    icon: <AlignCenterOutlined />,
    commandId: 'widget.alignCenterX',
  },
  {
    key: 'widget.alignRight',
    label: '右对齐',
    group: 'align',
    icon: <AlignRightOutlined />,
    commandId: 'widget.alignRight',
  },
  {
    key: 'widget.alignTop',
    label: '顶部对齐',
    group: 'align',
    icon: <VerticalAlignTopOutlined />,
    commandId: 'widget.alignTop',
  },
  {
    key: 'widget.alignCenterY',
    label: '垂直居中',
    group: 'align',
    icon: <VerticalAlignMiddleOutlined />,
    commandId: 'widget.alignCenterY',
  },
  {
    key: 'widget.alignBottom',
    label: '底部对齐',
    group: 'align',
    icon: <VerticalAlignBottomOutlined />,
    commandId: 'widget.alignBottom',
  },
];

const builtinItems: ContextMenuDefinition[] = [
  {
    key: 'canvas.create',
    label: '添加组件',
    group: 'canvas',
    icon: <PlusCircleOutlined />,
    children: createItems,
    when: (ctx) => ctx.selectionType === 'empty',
  },
  {
    key: 'widget.delete',
    label: '删除',
    group: 'common',
    icon: <DeleteOutlined />,
    shortcut: 'Backspace',
    commandId: 'widget.deleteSelected',
    when: (ctx) => ctx.selectionType !== 'empty',
  },
  {
    key: 'widget.lock',
    label: (ctx) => (ctx.widgets.some((widget) => widget.locked) ? '解锁' : '锁定'),
    group: 'common',
    commandId: 'widget.toggleLocked',
    icon: <LockOutlined />,
    when: (ctx) => ctx.selectionType !== 'empty',
  },
  {
    key: 'widget.visible',
    label: (ctx) => (ctx.widgets.some((widget) => widget.visible === false) ? '显示' : '隐藏'),
    group: 'common',
    commandId: 'widget.toggleVisible',
    icon: <UnlockOutlined />,
    when: (ctx) => ctx.selectionType !== 'empty',
  },
  {
    key: 'widget.layer',
    label: '图层顺序',
    group: 'layer',
    children: [
      { key: 'layer.bringToFront', label: '置顶', commandId: 'layer.bringToFront' },
      { key: 'layer.moveUp', label: '上移一层', commandId: 'layer.moveUp' },
      { key: 'layer.moveDown', label: '下移一层', commandId: 'layer.moveDown' },
      { key: 'layer.sendToBack', label: '置底', commandId: 'layer.sendToBack' },
    ],
    when: (ctx) => ctx.selectionType === 'single' && ctx.primaryWidget?.parentId === null,
  },
  {
    key: 'widget.group',
    label: '编组',
    group: 'group',
    icon: <AppstoreOutlined />,
    commandId: 'widget.groupSelected',
    when: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'widget.ungroup',
    label: '取消编组',
    group: 'group',
    icon: <BorderOutlined />,
    commandId: 'widget.ungroupSelected',
    when: (ctx) => ctx.selectionType === 'single' && ctx.primaryWidget?.type === 'group',
  },
  {
    key: 'widget.align',
    label: '对齐',
    group: 'align',
    children: alignItems,
    when: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'text.format',
    label: '文字样式',
    group: 'text',
    icon: <FontSizeOutlined />,
    children: [
      {
        key: 'text.toggleBold',
        label: '加粗',
        icon: <BoldOutlined />,
        commandId: 'text.toggleBold',
        commandArgs: (ctx) => ({ targetId: ctx.targetWidget?.id }),
      },
      {
        key: 'text.toggleItalic',
        label: '斜体',
        icon: <ItalicOutlined />,
        commandId: 'text.toggleItalic',
        commandArgs: (ctx) => ({ targetId: ctx.targetWidget?.id }),
      },
      {
        key: 'text.toggleUnderline',
        label: '下划线',
        commandId: 'text.toggleUnderline',
        commandArgs: (ctx) => ({ targetId: ctx.targetWidget?.id }),
      },
    ],
    when: (ctx) => isTextWidget(ctx.targetWidget),
  },
  {
    key: 'widget.fill',
    label: '填充颜色',
    group: 'appearance',
    children: FILL_COLORS.map((color) => ({
      key: `widget.fill.${color}`,
      label: color,
      commandId: 'widget.setFill',
      commandArgs: (ctx) => ({ targetId: ctx.targetWidget?.id, fill: color }),
    })),
    when: (ctx) => {
      const widget = ctx.targetWidget;
      return isFillEditableWidget(widget) && (isTextWidget(widget) || SHAPE_TYPES.has(widget.type));
    },
  },
];

/**
 * 注册内置右键菜单项。
 *
 * @returns void
 */
export function registerBuiltinContextMenus(): void {
  if (registered) return;
  contextMenuRegistry.registerMany(builtinItems);
  registered = true;
}
