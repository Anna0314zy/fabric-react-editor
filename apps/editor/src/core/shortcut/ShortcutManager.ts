import hotkeys, { type KeyHandler } from 'hotkeys-js';
import { commandManager } from '@/core/command';

const DEFAULT_SCOPE = 'global';
const MODIFIER_ORDER = ['ctrl', 'command', 'alt', 'shift'];
const KEY_ALIAS: Record<string, string> = {
  control: 'ctrl',
  cmd: 'command',
  meta: 'command',
  option: 'alt',
};

/** 作用域；'global' 为默认编辑器作用域，'all' 可跨作用域触发 */
export type ShortcutScope = string;

export type ShortcutConflictPolicy = 'warn' | 'override' | 'ignore' | 'error';

export interface ShortcutOptions {
  /** 作用域，默认 'global' */
  scope?: ShortcutScope;
  /**
   * 是否在可输入元素（INPUT / TEXTAREA / contentEditable）中也触发
   * 默认 false：避免与文本输入冲突
   */
  enableInInput?: boolean;
  /** 是否阻止浏览器默认行为，默认 true */
  preventDefault?: boolean;
  /** 冲突处理策略，默认 warn：跳过冲突并打印警告 */
  conflict?: ShortcutConflictPolicy;
}

export interface ShortcutRegistration extends ShortcutOptions {
  keys: string;
  commandId: string;
}

export interface ShortcutBinding {
  /** 已展开为 hotkeys-js 原生格式的 keys（mod 已替换） */
  keys: string;
  /** 规范化后的每个按键组合，用于冲突检测 */
  normalizedKeys: string[];
  commandId: string;
  scope: ShortcutScope;
  enableInInput: boolean;
  preventDefault: boolean;
}

// ========================
// key parsing
// ========================

/**
 * 把 'mod+z, mod+shift+z' 展开为 hotkeys-js 原生格式 'command+z,ctrl+z, command+shift+z,ctrl+shift+z'
 * mod 在 macOS 表示 ⌘，在 Windows / Linux 表示 Ctrl
 *
 * @param keys 用户侧注册的快捷键字符串，多个快捷键用逗号分隔。
 * @returns 展开 mod 后的 hotkeys-js 快捷键字符串。
 */
function expandModKey(keys: string): string {
  return keys
    .split(',')
    .map((seg) => seg.trim())
    .filter(Boolean)
    .map((seg) => {
      if (!/\bmod\b/i.test(seg)) return seg;
      const cmd = seg.replace(/\bmod\b/gi, 'command');
      const ctrl = seg.replace(/\bmod\b/gi, 'ctrl');
      return `${cmd},${ctrl}`;
    })
    .join(',');
}

/**
 * 把逗号分隔的快捷键字符串拆成单个快捷键。
 *
 * @param keys 快捷键字符串，比如 command+z,ctrl+z。
 * @returns 去掉空白项后的快捷键数组。
 */
function splitKeys(keys: string): string[] {
  return keys
    .split(',')
    .map((seg) => seg.trim())
    .filter(Boolean);
}

/**
 * 标准化单个快捷键，保证同义写法能被冲突检测识别。
 *
 * @param key 单个快捷键，比如 Shift+Ctrl+Z。
 * @returns 小写且修饰键顺序稳定的快捷键，比如 ctrl+shift+z。
 */
function normalizeKey(key: string): string {
  return key
    .toLowerCase()
    .split('+')
    .map((part) => KEY_ALIAS[part.trim()] ?? part.trim())
    .filter(Boolean)
    .sort((a, b) => {
      const ai = MODIFIER_ORDER.indexOf(a);
      const bi = MODIFIER_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .join('+');
}

/**
 * 判断事件目标是否是可输入区域。
 *
 * @param target 键盘事件的触发目标。
 * @returns true 表示当前焦点位于输入控件或 contentEditable 节点内。
 */
function isEditableTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

/**
 * ShortcutManager —— 全局唯一的快捷键注册 / 分发入口
 *
 * 职责：
 * 1. 基于 hotkeys-js 二次封装：作用域切换、可输入元素自动忽略、平台键位归一化（mod=⌘/Ctrl）。
 * 2. 只做"按键 → commandId"的映射注册，不直接调用业务逻辑。
 *
 * 严禁：
 * - 在业务组件 / Hook 中独立 window.addEventListener('keydown')。
 * - 业务组件直接 import hotkeys-js。
 * - 在快捷键 handler 中直接调用 store / history / fabric 等 Editor API。
 */
class ShortcutManagerImpl {
  /**
 *  bindings 它保存当前已经注册过的所有快捷键绑定。
用途：
给快捷键面板展示
给调试工具枚举
未来做用户自定义快捷键时展示当前配置
list() 方法就是返回它
 */
  private readonly bindings: ShortcutBinding[] = [];
  /**
   * bindingIndex 用于冲突检测
   */
  private readonly bindingIndex = new Map<string, ShortcutBinding>();
  private readonly scopeStack: ShortcutScope[] = [];

  /**
   * 初始化 hotkeys-js 的全局行为。
   *
   * 这里把 hotkeys.filter 放开，输入区域是否触发由每个 binding 的 options 控制。
   */
  constructor() {
    hotkeys.filter = () => true;
    hotkeys.setScope(DEFAULT_SCOPE);
  }

  // ========================
  // binding index
  // ========================

  /**
   * 生成快捷键索引 key，用于同一 scope 下的冲突检测。
   *
   * @param scope 快捷键作用域。
   * @param key 已标准化或待标准化的单个快捷键。
   * @returns 形如 global::ctrl+z 的索引 key。
   */
  private getBindingKey(scope: ShortcutScope, key: string): string {
    return `${scope}::${normalizeKey(key)}`;
  }

  /**
   * 把 binding 写入内存列表和索引表。
   *
   * @param binding 已完成 hotkeys-js 注册的快捷键绑定对象。
   */
  private addBinding(binding: ShortcutBinding): void {
    this.bindings.push(binding);
    binding.normalizedKeys.forEach((key) => {
      this.bindingIndex.set(this.getBindingKey(binding.scope, key), binding);
    });
  }

  /**
   * 从 hotkeys-js、内存列表和索引表中移除 binding。
   *
   * @param binding 要移除的快捷键绑定对象。
   */
  private removeBinding(binding: ShortcutBinding): void {
    hotkeys.unbind(binding.keys, binding.scope);
    binding.normalizedKeys.forEach((key) => {
      this.bindingIndex.delete(this.getBindingKey(binding.scope, key));
    });
    const idx = this.bindings.indexOf(binding);
    if (idx >= 0) this.bindings.splice(idx, 1);
  }

  /**
   * 查找一组按键在指定 scope 下已经存在的绑定。
   *
   * @param scope 快捷键作用域。
   * @param normalizedKeys 已标准化的快捷键数组。
   * @returns 发生冲突的按键和旧 binding。
   */
  private findConflicts(
    scope: ShortcutScope,
    normalizedKeys: string[],
  ): Array<{ key: string; binding: ShortcutBinding }> {
    return normalizedKeys
      .map((key) => ({ key, binding: this.bindingIndex.get(this.getBindingKey(scope, key)) }))
      .filter((item): item is { key: string; binding: ShortcutBinding } => !!item.binding);
  }

  // ========================
  // conflict resolving
  // ========================

  /**
   * 解析快捷键冲突，并根据策略返回本次真正允许注册的按键列表。
   *
   * @param scope 当前要注册到哪个作用域，比如 global、modal。
   * @param normalizedKeys 已经标准化后的按键，比如 ctrl+z、command+z。
   * @param policy 冲突策略，支持 warn、override、ignore、error。
   * @returns 无冲突或可注册的按键列表；返回空数组表示本次没有可注册按键。
   */
  private resolveConflicts(
    scope: ShortcutScope,
    normalizedKeys: string[],
    policy: ShortcutConflictPolicy,
  ): string[] {
    const conflicted = this.findConflicts(scope, normalizedKeys);

    if (conflicted.length === 0) return normalizedKeys;

    const detail = conflicted
      .map(({ key, binding }) => `${key} -> ${binding.commandId}`)
      .join(', ');

    if (policy === 'error') {
      throw new Error(`[ShortcutManager] shortcut conflict in scope "${scope}": ${detail}`);
    }

    if (policy === 'override') {
      Array.from(new Set(conflicted.map(({ binding }) => binding))).forEach((binding) => {
        this.removeBinding(binding);
      });
      return normalizedKeys;
    }

    if (policy === 'warn') {
      console.warn(`[ShortcutManager] shortcut conflict in scope "${scope}", skipped: ${detail}`);
    }

    return normalizedKeys.filter((key) => !this.bindingIndex.has(this.getBindingKey(scope, key)));
  }

  // ========================
  // handler / binding
  // ========================

  /**
   * 创建 hotkeys-js 事件处理函数。
   *
   * @param commandId 快捷键触发的命令 id。
   * @param options 当前快捷键注册选项。
   * @returns 交给 hotkeys-js 的键盘事件处理函数。
   */
  private createHandler(commandId: string, options: ShortcutOptions): KeyHandler {
    return (event) => {
      if (!options.enableInInput && isEditableTarget(event.target)) return;
      if (options.preventDefault !== false) event.preventDefault();
      commandManager.execute(commandId);
    };
  }

  /**
   * 创建内部 binding 记录。
   *
   * @param keys 实际注册到 hotkeys-js 的快捷键字符串。
   * @param normalizedKeys 实际注册的标准化快捷键数组。
   * @param commandId 快捷键触发的命令 id。
   * @param scope 快捷键作用域。
   * @param options 当前快捷键注册选项。
   * @returns 可被 list、unregister、冲突检测复用的 binding 记录。
   */
  private createBinding(
    keys: string,
    normalizedKeys: string[],
    commandId: string,
    scope: ShortcutScope,
    options: ShortcutOptions,
  ): ShortcutBinding {
    return {
      keys,
      normalizedKeys,
      commandId,
      scope,
      enableInInput: !!options.enableInInput,
      preventDefault: options.preventDefault !== false,
    };
  }

  // ========================
  // registration
  // ========================

  /**
   * 注册快捷键到命令的映射。
   *
   * @param keys 支持 'mod+z' / 'mod+shift+z, mod+y' 等组合，多个用逗号分隔。
   * @param commandId 已在 CommandManager 注册过的命令 id。
   * @param options 快捷键注册选项，包括 scope、输入区域策略、冲突策略等。
   */
  register(keys: string, commandId: string, options: ShortcutOptions = {}): void {
    const scope = options.scope ?? DEFAULT_SCOPE;
    const expanded = expandModKey(keys);
    const normalizedKeys = splitKeys(expanded).map(normalizeKey);
    const activeKeys = this.resolveConflicts(scope, normalizedKeys, options.conflict ?? 'warn');
    if (activeKeys.length === 0) return;

    const activeKeyString = activeKeys.join(',');
    hotkeys(activeKeyString, { scope }, this.createHandler(commandId, options));
    this.addBinding(this.createBinding(activeKeyString, activeKeys, commandId, scope, options));
  }

  /**
   * 批量注册快捷键，推荐内置快捷键和插件快捷键使用声明式配置。
   *
   * @param registrations 快捷键注册配置数组。
   */
  registerMany(registrations: readonly ShortcutRegistration[]): void {
    registrations.forEach(({ keys, commandId, ...options }) => {
      this.register(keys, commandId, options);
    });
  }

  /**
   * 注销指定 scope 下的一组快捷键。
   *
   * @param keys 支持 mod 写法和逗号分隔的快捷键字符串。
   * @param scope 要注销的快捷键作用域，默认 global。
   */
  unregister(keys: string, scope: ShortcutScope = DEFAULT_SCOPE): void {
    const normalizedKeys = splitKeys(expandModKey(keys)).map(normalizeKey);
    const matched = new Set<ShortcutBinding>();
    normalizedKeys.forEach((key) => {
      const binding = this.bindingIndex.get(this.getBindingKey(scope, key));
      if (binding) matched.add(binding);
    });
    matched.forEach((binding) => this.removeBinding(binding));
  }

  // ========================
  // scope
  // ========================

  /**
   * 直接切换当前快捷键作用域。
   *
   * @param scope 要激活的快捷键作用域。
   */
  setScope(scope: ShortcutScope): void {
    hotkeys.setScope(scope);
  }

  /**
   * 获取当前激活的快捷键作用域。
   *
   * @returns 当前 hotkeys-js 激活的 scope。
   */
  getScope(): string {
    return hotkeys.getScope();
  }

  /**
   * 进入临时作用域，并返回恢复函数。
   *
   * @param scope 要临时进入的作用域，比如 modal、textEditing。
   * @returns 调用后恢复到进入前 scope 的函数，适合在 React effect cleanup 中使用。
   */
  enterScope(scope: ShortcutScope): () => void {
    const previous = this.getScope();
    this.scopeStack.push(previous);
    this.setScope(scope);
    return () => {
      const fallback = this.scopeStack.pop() ?? DEFAULT_SCOPE;
      this.setScope(fallback);
    };
  }

  // ========================
  // query
  // ========================

  /**
   * 枚举当前所有快捷键绑定。
   *
   * @returns 只读 binding 列表，可用于快捷键面板、调试工具、冲突提示等场景。
   */
  list(): readonly ShortcutBinding[] {
    return this.bindings;
  }
}

/** 全局单例 */
export const shortcutManager = new ShortcutManagerImpl();
