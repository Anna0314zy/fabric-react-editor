/**
 * 命令上下文
 * 预留可注入的运行时上下文（如 store、canvas 引用等）。
 * 当前为空对象，后续按需扩展，避免命令直接 import 全局单例。
 */
export interface CommandContext {
  // 占位：后续可扩展 { store, canvas, history, ... }
  readonly _placeholder?: never;
}

/** 命令对象：快捷键 / 菜单 / 按钮 / 右键菜单的共享调用单元 */
export interface Command {
  /** 全局唯一 id，建议用 'editor.xxx' / 'widget.xxx' 命名空间 */
  id: string;
  /** 用于 UI 展示（菜单项、tooltip） */
  title?: string;
  /** 是否可执行；不可执行时快捷键不触发，UI 可置灰。默认 true */
  canExecute?: (ctx: CommandContext) => boolean;
  /** 命令执行体，内部允许调用 Editor API（store / history / canvas） */
  run: (ctx: CommandContext) => void;
}
