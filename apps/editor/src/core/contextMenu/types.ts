import type { ReactNode } from 'react';
import type { PageData } from '@/types/page';
import type { Widget, WidgetType } from '@/types/widget';

export type ContextMenuSelectionType = 'empty' | 'single' | 'multi';

export interface ContextMenuPoint {
  x: number;
  y: number;
}

export interface ContextMenuContext {
  /** 当前激活页面 */
  page: PageData;
  /** 鼠标右键位置，画布坐标系 */
  canvasPoint: ContextMenuPoint;
  /** 当前选中的 widget id 列表 */
  selectedIds: string[];
  /** 当前选中的 widget 数据 */
  widgets: Widget[];
  /** 多选时的主对象，默认取第一个选中对象 */
  primaryWidget?: Widget;
  /** 本次右键命中的 widget，组内子元素会优先作为 targetWidget */
  targetWidget?: Widget;
  /** 选区类型 */
  selectionType: ContextMenuSelectionType;
  /** 命中组件类型，便于按组件类型扩展菜单 */
  widgetType?: WidgetType;
}

export interface ContextMenuItem {
  /** 菜单项唯一 key */
  key: string;
  /** 展示文案，可根据命中上下文动态生成 */
  label: string | ((ctx: ContextMenuContext) => string);
  /** 左侧图标 */
  icon?: ReactNode;
  /** 分组名，相邻分组会自动插入分割线 */
  group?: string;
  /** 右侧提示，如快捷键 */
  shortcut?: string;
  /** 优先使用 commandId 触发业务能力 */
  commandId?: string;
  /** 少数需要右键位置或组件类型上下文的菜单项可自定义点击逻辑 */
  onClick?: (ctx: ContextMenuContext) => void;
  /** 子菜单 */
  children?: ContextMenuItem[];
  /** 当前上下文是否展示 */
  visible?: (ctx: ContextMenuContext) => boolean;
  /** 当前上下文是否禁用 */
  disabled?: (ctx: ContextMenuContext) => boolean;
}
