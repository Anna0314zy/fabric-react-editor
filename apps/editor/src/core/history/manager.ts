import type { Command } from './types';

/** 默认历史栈最大长度 */
const DEFAULT_LIMIT = 200;

/**
 * 历史快照：作为 React useSyncExternalStore 的 snapshot
 * - 字段变化必须返回新引用，所以每次 emit 时整体重建
 * - version 用于强制刷新（即便 canUndo/canRedo 不变，也代表历史栈发生变化）
 */
export interface HistorySnapshot {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly version: number;
}

/**
 * 历史管理器
 * - 历史相关数据全部内聚在此（undo/redo 栈、canUndo/canRedo、version）
 * - 通过 subscribe + getSnapshot 桥接 React（useSyncExternalStore）
 * - dispatch(cmd): execute 后入栈，并尝试与栈顶 merge；同时清空 redo 栈
 * - undo / redo: 在两个栈间挪动
 */
export class HistoryManager {
  /** 全局唯一实例（懒加载） */
  private static instance: HistoryManager | null = null;

  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private limit: number;
  private listeners = new Set<() => void>();
  private snapshot: HistorySnapshot = { canUndo: false, canRedo: false, version: 0 };

  /** 私有构造，禁止外部 new，确保全局唯一 */
  private constructor(limit = DEFAULT_LIMIT) {
    this.limit = limit;
  }

  /** 获取全局唯一的历史管理器实例 */
  static getInstance(limit = DEFAULT_LIMIT): HistoryManager {
    if (!HistoryManager.instance) {
      HistoryManager.instance = new HistoryManager(limit);
    }
    return HistoryManager.instance;
  }

  get canUndo(): boolean {
    return this.snapshot.canUndo;
  }

  get canRedo(): boolean {
    return this.snapshot.canRedo;
  }

  /** 订阅历史栈变更（绑定 this，便于直接传给 useSyncExternalStore） */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** 获取历史快照（同一份引用直至下一次 emit，满足 useSyncExternalStore 一致性要求） */
  getSnapshot = (): HistorySnapshot => this.snapshot;

  dispatch(cmd: Command): void {
    cmd.execute();

    // 尝试与栈顶合并
    const top = this.undoStack[this.undoStack.length - 1];
    if (top && cmd.merge) {
      const merged = cmd.merge(top);
      if (merged) {
        this.undoStack[this.undoStack.length - 1] = merged;
        this.redoStack = [];
        this.emit();
        return;
      }
    }

    this.undoStack.push(cmd);
    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.emit();
  }

  undo = (): void => {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
    this.emit();
  };

  redo = (): void => {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
    this.emit();
  };

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }

  private emit(): void {
    // 重建快照引用，触发 useSyncExternalStore 比较
    this.snapshot = {
      canUndo: this.undoStack.length > 0,
      canRedo: this.redoStack.length > 0,
      version: this.snapshot.version + 1,
    };
    this.listeners.forEach((l) => l());
  }
}
