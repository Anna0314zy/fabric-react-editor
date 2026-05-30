import {
  AlignCenterOutlined,
  AlignLeftOutlined,
  AlignRightOutlined,
  AppstoreOutlined,
  BorderOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignMiddleOutlined,
  VerticalAlignTopOutlined,
} from '@ant-design/icons';
import { floatingMenuRegistry } from './FloatingMenuRegistry';
import type { FloatingMenuItem } from './types';

let registered = false;

const alignItems: FloatingMenuItem[] = [
  {
    key: 'widget.alignLeft',
    label: '左对齐',
    group: 'align',
    icon: <AlignLeftOutlined />,
    commandId: 'widget.alignLeft',
    visible: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'widget.alignCenterX',
    label: '水平居中对齐',
    group: 'align',
    icon: <AlignCenterOutlined />,
    commandId: 'widget.alignCenterX',
    visible: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'widget.alignRight',
    label: '右对齐',
    group: 'align',
    icon: <AlignRightOutlined />,
    commandId: 'widget.alignRight',
    visible: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'widget.alignTop',
    label: '顶部对齐',
    group: 'align',
    icon: <VerticalAlignTopOutlined />,
    commandId: 'widget.alignTop',
    visible: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'widget.alignCenterY',
    label: '垂直居中对齐',
    group: 'align',
    icon: <VerticalAlignMiddleOutlined />,
    commandId: 'widget.alignCenterY',
    visible: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'widget.alignBottom',
    label: '底部对齐',
    group: 'align',
    icon: <VerticalAlignBottomOutlined />,
    commandId: 'widget.alignBottom',
    visible: (ctx) => ctx.selectionType === 'multi',
  },
];

const builtinItems: FloatingMenuItem[] = [
  {
    key: 'widget.delete',
    label: '删除',
    group: 'common',
    icon: <DeleteOutlined />,
    commandId: 'widget.deleteSelected',
  },
  {
    key: 'widget.lock',
    label: (ctx) => (ctx.widgets.some((widget) => widget.locked) ? '已锁定' : '未锁定'),
    group: 'common',
    commandId: 'widget.toggleLocked',
    render: (ctx) =>
      ctx.widgets.some((widget) => widget.locked) ? <LockOutlined /> : <UnlockOutlined />,
  },
  {
    key: 'widget.group',
    label: '编组',
    group: 'common',
    icon: <AppstoreOutlined />,
    commandId: 'widget.groupSelected',
    visible: (ctx) => ctx.selectionType === 'multi',
  },
  {
    key: 'widget.ungroup',
    label: '取消编组',
    group: 'common',
    icon: <BorderOutlined />,
    commandId: 'widget.ungroupSelected',
    visible: (ctx) => ctx.selectionType === 'single' && ctx.primaryWidget?.type === 'group',
  },
  ...alignItems,
];

/**
 * 注册内置悬浮菜单项。
 *
 * @returns void
 */
export function registerBuiltinFloatingMenus(): void {
  if (registered) return;
  floatingMenuRegistry.registerMany(builtinItems);
  registered = true;
}
