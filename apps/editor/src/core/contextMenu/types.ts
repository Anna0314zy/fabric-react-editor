import type { ReactNode } from 'react';
import type { CommandArgs } from '@/core/command';
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

export interface ContextMenuDefinition {
  /** 菜单项唯一 key */
  key: string;
  /** 展示文案，可根据命中上下文动态生成 */
  label: string | ((ctx: ContextMenuContext) => string);
  /** 左侧图标 */
  icon?: ReactNode;
  /** 分组名，相邻分组会自动插入分割线 */
  group?: string;
  /** 同组内排序权重，数值越小越靠前 */
  order?: number;
  /** 右侧提示，如快捷键 */
  shortcut?: string;
  /** 优先使用 commandId 触发业务能力 */
  commandId?: string;
  /** 将菜单上下文转换为命令调用参数 */
  commandArgs?: (ctx: ContextMenuContext) => CommandArgs;
  /** 子菜单 */
  children?: ContextMenuDefinition[];
  /** 声明该菜单入口适用的上下文，不负责命令能否执行 */
  when?: (ctx: ContextMenuContext) => boolean;
}

/** Resolver 输出给 UI 的纯展示模型，不包含业务判断函数。 */
export interface ContextMenuViewModel {
  key: string;
  label: string;
  icon?: ReactNode;
  group?: string;
  order: number;
  shortcut?: string;
  commandId?: string;
  commandArgs?: CommandArgs;
  disabled: boolean;
  children?: ContextMenuViewModel[];
}
