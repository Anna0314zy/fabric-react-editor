import type { Command, CommandContext } from './types';

/**
 * CommandManager —— 命令注册中心
 *
 * 职责：
 * 1. 集中注册编辑器内所有"可调用单元"，UI / 快捷键 / 菜单都通过 commandId 触发。
 * 2. 屏蔽业务调用细节，便于做权限、可执行性判断、日志、埋点。
 *
 * 严禁：
 * - 在此处监听键盘事件（应由 ShortcutManager 负责）。
 * - UI 组件绕过 commandId 直接 import 业务方法。
 */
class CommandManagerImpl {
  private readonly commands = new Map<string, Command>();
  private readonly ctx: CommandContext = {};

  /** 注册命令；同 id 重复注册会覆盖并打 warn */
  register(cmd: Command): void {
    if (this.commands.has(cmd.id)) {
      console.warn(`[CommandManager] duplicate command id: ${cmd.id}, will be overridden.`);
    }
    this.commands.set(cmd.id, cmd);
  }

  /** 注销命令 */
  unregister(id: string): void {
    this.commands.delete(id);
  }

  has(id: string): boolean {
    return this.commands.has(id);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  /** 调试 / UI 枚举用 */
  list(): readonly Command[] {
    return Array.from(this.commands.values());
  }

  /** 命令是否当前可执行；未注册返回 false */
  canExecute(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) return false;
    return cmd.canExecute ? cmd.canExecute(this.ctx) : true;
  }

  /**
   * 触发命令；返回是否真的执行
   * - 未注册：返回 false 并 warn
   * - canExecute 为 false：返回 false（静默）
   */
  execute(id: string): boolean {
    const cmd = this.commands.get(id);
    if (!cmd) {
      console.warn(`[CommandManager] command not found: ${id}`);
      return false;
    }
    if (cmd.canExecute && !cmd.canExecute(this.ctx)) return false;
    cmd.run(this.ctx);
    return true;
  }
}

/** 全局单例 */
export const commandManager = new CommandManagerImpl();
