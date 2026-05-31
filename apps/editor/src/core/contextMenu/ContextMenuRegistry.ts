import type { ContextMenuContext, ContextMenuItem } from './types';

function resolveChildren(item: ContextMenuItem, ctx: ContextMenuContext): ContextMenuItem {
  if (!item.children) return item;
  return {
    ...item,
    children: item.children.filter((child) => child.visible?.(ctx) ?? true),
  };
}

class ContextMenuRegistryImpl {
  private readonly items = new Map<string, ContextMenuItem>();

  /**
   * 注册一个右键菜单项。
   *
   * @param item item：菜单项配置，包含展示条件、commandId、子菜单或自定义点击逻辑。
   * @returns void
   */
  register(item: ContextMenuItem): void {
    this.items.set(item.key, item);
  }

  /**
   * 批量注册右键菜单项。
   *
   * @param items items：需要注册的菜单项列表。
   * @returns void
   */
  registerMany(items: ContextMenuItem[]): void {
    items.forEach((item) => this.register(item));
  }

  /**
   * 根据本次右键上下文解析可展示的菜单项。
   *
   * @param ctx ctx：选区、命中组件、画布坐标等上下文。
   * @returns 满足 visible 条件的菜单项列表，顺序等同注册顺序。
   */
  resolve(ctx: ContextMenuContext): ContextMenuItem[] {
    return Array.from(this.items.values())
      .filter((item) => item.visible?.(ctx) ?? true)
      .map((item) => resolveChildren(item, ctx))
      .filter((item) => !item.children || item.children.length > 0);
  }
}

export const contextMenuRegistry = new ContextMenuRegistryImpl();
