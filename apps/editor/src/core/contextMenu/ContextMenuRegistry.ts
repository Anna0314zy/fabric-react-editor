import type { ContextMenuDefinition } from './types';

class ContextMenuRegistryImpl {
  private readonly items = new Map<string, ContextMenuDefinition>();

  /**
   * 注册一个右键菜单项。
   *
   * @param item item：菜单项配置，包含展示条件、commandId、子菜单或自定义点击逻辑。
   * @returns void
   */
  register(item: ContextMenuDefinition): void {
    this.items.set(item.key, item);
  }

  /**
   * 批量注册右键菜单项。
   *
   * @param items items：需要注册的菜单项列表。
   * @returns void
   */
  registerMany(items: ContextMenuDefinition[]): void {
    items.forEach((item) => this.register(item));
  }

  /** 返回原始菜单定义；展示规则由 ContextMenuResolver 统一处理。 */
  list(): readonly ContextMenuDefinition[] {
    return Array.from(this.items.values());
  }
}

export const contextMenuRegistry = new ContextMenuRegistryImpl();
