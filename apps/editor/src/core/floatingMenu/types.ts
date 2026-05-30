import type { ReactNode } from 'react';
import type { Widget, WidgetType } from '@/types/widget';

export type FloatingMenuPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface FloatingMenuContext {
  /** 当前选中的 widget id 列表 */
  selectedIds: string[];
  /** 当前选中的 widget 数据 */
  widgets: Widget[];
  /** 多选时的主对象，默认取第一个选中对象 */
  primaryWidget?: Widget;
  /** 选区类型 */
  selectionType: 'empty' | 'single' | 'multi';
  /** 主对象类型，便于组件类型菜单做 visible 判断 */
  widgetType?: WidgetType;
}

export interface FloatingMenuItem {
  /** 菜单项唯一 key */
  key: string;
  /** 展示文案，同时作为 tooltip / aria-label；可根据选区状态动态生成 */
  label: string | ((ctx: FloatingMenuContext) => string);
  /** 菜单按钮图标 */
  icon?: ReactNode;
  /** 分组名，相邻分组会自动插入分割线 */
  group?: string;
  /** 优先使用 commandId 触发业务能力 */
  commandId?: string;
  /** 少数复杂菜单项可自定义点击逻辑 */
  onClick?: (ctx: FloatingMenuContext) => void;
  /** 当前上下文是否展示 */
  visible?: (ctx: FloatingMenuContext) => boolean;
  /** 当前上下文是否禁用 */
  disabled?: (ctx: FloatingMenuContext) => boolean;
  /** 复杂控件自定义渲染，如色板、字号选择器 */
  render?: (ctx: FloatingMenuContext) => ReactNode;
}
