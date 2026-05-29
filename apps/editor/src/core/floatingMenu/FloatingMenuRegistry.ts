import type { FloatingMenuContext, FloatingMenuItem } from './types';

class FloatingMenuRegistryImpl {
  private readonly items = new Map<string, FloatingMenuItem>();

  /**
   * 注册一个悬浮菜单项。
   *
   * @param item item：菜单项配置，包含展示条件、commandId 或自定义 render/onClick。
   * @returns void
   */
  register(item: FloatingMenuItem): void {
    this.items.set(item.key, item);
  }

  /**
   * 批量注册悬浮菜单项。
   *
   * @param items items：需要注册的菜单项列表。
   * @returns void
   */
  registerMany(items: FloatingMenuItem[]): void {
    items.forEach((item) => this.register(item));
  }

  /**
   * 根据当前选区上下文解析可展示的菜单项。
   *
   * @param ctx ctx：当前选区、组件类型、widget 数据等上下文。
   * @returns 满足 visible 条件的菜单项列表，顺序等同注册顺序。
   */
  resolve(ctx: FloatingMenuContext): FloatingMenuItem[] {
    if (ctx.selectionType === 'empty') return [];
    return Array.from(this.items.values()).filter((item) => item.visible?.(ctx) ?? true);
  }
}

export const floatingMenuRegistry = new FloatingMenuRegistryImpl();
