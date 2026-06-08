import type { Command } from './types';
import type { EditorDocumentSnapshot, HistorySnapshotAdapter } from './snapshot';

/** 默认历史栈最大长度 */
const DEFAULT_LIMIT = 200;
const DEFAULT_CHECKPOINT_INTERVAL = 25;
const SNAPSHOT_RESTORE_COST = 5;

export interface HistoryEntry {
  readonly id: number;
  readonly name: string;
  readonly createdAt: number;
}

interface InternalHistoryEntry extends HistoryEntry {
  readonly command: Command;
}

export interface HistoryCheckpoint {
  readonly id: number;
  readonly index: number;
  readonly createdAt: number;
}

interface InternalHistoryCheckpoint extends HistoryCheckpoint {
  readonly snapshot: EditorDocumentSnapshot;
}

/**
 * 历史快照：作为 React useSyncExternalStore 的 snapshot
 * - 字段变化必须返回新引用，所以每次 emit 时整体重建
 * - version 用于强制刷新（即便 canUndo/canRedo 不变，也代表历史栈发生变化）
 */
export interface HistorySnapshot {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly version: number;
  readonly entries: readonly HistoryEntry[];
  readonly currentIndex: number;
  readonly checkpoints: readonly HistoryCheckpoint[];
  readonly isJumping: boolean;
}

/**
 * 历史管理器
 * - 历史相关数据全部内聚在此（历史列表、当前指针、canUndo/canRedo、version）
 * - 通过 subscribe + getSnapshot 桥接 React（useSyncExternalStore）
 * - dispatch(cmd): execute 后截断未来分支并入栈，同时尝试与当前命令 merge
 * - undo / redo / goTo: 移动历史指针并执行对应的反向或正向操作
 */
export class HistoryManager {
  /** 全局唯一实例（懒加载） */
  private static instance: HistoryManager | null = null;

  private entries: InternalHistoryEntry[] = [];
  private currentIndex = -1;
  private nextEntryId = 1;
  private checkpoints: InternalHistoryCheckpoint[] = [];
  private nextCheckpointId = 1;
  private baseSnapshot: EditorDocumentSnapshot | null = null;
  private snapshotAdapter: HistorySnapshotAdapter | null = null;
  private readonly checkpointInterval: number;
  private isJumping = false;
  private limit: number;
  private listeners = new Set<() => void>();
  private snapshot: HistorySnapshot = {
    canUndo: false,
    canRedo: false,
    version: 0,
    entries: [],
    currentIndex: -1,
    checkpoints: [],
    isJumping: false,
  };

  /** 私有构造，禁止外部 new，确保全局唯一 */
  private constructor(limit = DEFAULT_LIMIT, checkpointInterval = DEFAULT_CHECKPOINT_INTERVAL) {
    this.limit = limit;
    this.checkpointInterval = checkpointInterval;
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

  configureSnapshotAdapter(adapter: HistorySnapshotAdapter): void {
    this.snapshotAdapter = adapter;
    if (this.entries.length === 0) {
      this.baseSnapshot = adapter.capture();
      this.checkpoints = [];
    }
    this.emit();
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
    if (this.isJumping) return;
    cmd.execute();

    // 撤销后执行新操作会产生新分支，旧的未来记录随之失效。
    if (this.currentIndex < this.entries.length - 1) {
      this.entries.splice(this.currentIndex + 1);
      this.checkpoints = this.checkpoints.filter(
        (checkpoint) => checkpoint.index <= this.currentIndex,
      );
    }

    const currentEntry = this.entries[this.currentIndex];
    if (currentEntry && cmd.merge) {
      const merged = cmd.merge(currentEntry.command);
      if (merged) {
        this.entries[this.currentIndex] = {
          ...currentEntry,
          name: merged.name,
          command: merged,
        };
        this.refreshCheckpointAtCurrentIndex();
        this.emit();
        return;
      }
    }

    this.entries.push({
      id: this.nextEntryId++,
      name: cmd.name,
      createdAt: Date.now(),
      command: cmd,
    });
    this.currentIndex = this.entries.length - 1;
    this.captureCheckpointIfNeeded();

    this.trimHistory();
    this.emit();
  }

  undo = (): void => {
    if (this.currentIndex < 0 || this.isJumping) return;
    this.runReplay(() => {
      this.entries[this.currentIndex].command.undo();
      this.currentIndex--;
    });
  };

  redo = (): void => {
    if (this.currentIndex >= this.entries.length - 1 || this.isJumping) return;
    this.runReplay(() => {
      const nextIndex = this.currentIndex + 1;
      this.entries[nextIndex].command.execute();
      this.currentIndex = nextIndex;
    });
  };

  goTo(targetIndex: number): void {
    const nextIndex = Math.max(-1, Math.min(targetIndex, this.entries.length - 1));
    if (nextIndex === this.currentIndex || this.isJumping) return;

    const checkpoint = this.findCheckpoint(nextIndex);
    const directCost = Math.abs(this.currentIndex - nextIndex);
    const checkpointCost = checkpoint
      ? SNAPSHOT_RESTORE_COST + (nextIndex - checkpoint.index)
      : Number.POSITIVE_INFINITY;

    this.runReplay(() => {
      if (checkpoint && checkpointCost < directCost) {
        this.restoreCheckpoint(checkpoint, nextIndex);
        return;
      }
      this.moveDirectly(nextIndex);
    });
  }

  clear(): void {
    this.entries = [];
    this.currentIndex = -1;
    this.checkpoints = [];
    this.baseSnapshot = this.snapshotAdapter?.capture() ?? null;
    this.emit();
  }

  private runReplay(task: () => void): void {
    this.isJumping = true;
    this.emit();
    this.snapshotAdapter?.beginReplay?.();
    try {
      task();
    } finally {
      this.snapshotAdapter?.endReplay?.();
      this.isJumping = false;
      this.emit();
    }
  }

  private moveDirectly(targetIndex: number): void {
    while (this.currentIndex > targetIndex) {
      this.entries[this.currentIndex].command.undo();
      this.currentIndex--;
    }

    while (this.currentIndex < targetIndex) {
      const nextIndex = this.currentIndex + 1;
      this.entries[nextIndex].command.execute();
      this.currentIndex = nextIndex;
    }
  }

  private findCheckpoint(targetIndex: number): InternalHistoryCheckpoint | null {
    if (!this.snapshotAdapter) return null;

    let candidate: InternalHistoryCheckpoint | null = this.baseSnapshot
      ? {
          id: 0,
          index: -1,
          createdAt: 0,
          snapshot: this.baseSnapshot,
        }
      : null;

    for (const checkpoint of this.checkpoints) {
      if (checkpoint.index > targetIndex) break;
      candidate = checkpoint;
    }
    return candidate;
  }

  private restoreCheckpoint(checkpoint: InternalHistoryCheckpoint, targetIndex: number): void {
    const adapter = this.snapshotAdapter;
    if (!adapter) {
      this.moveDirectly(targetIndex);
      return;
    }

    adapter.restore(checkpoint.snapshot);
    this.currentIndex = checkpoint.index;
    while (this.currentIndex < targetIndex) {
      const nextIndex = this.currentIndex + 1;
      this.entries[nextIndex].command.execute();
      this.currentIndex = nextIndex;
    }
  }

  private captureCheckpointIfNeeded(): void {
    const adapter = this.snapshotAdapter;
    if (!adapter || this.currentIndex < 0) return;
    if ((this.currentIndex + 1) % this.checkpointInterval !== 0) return;

    this.checkpoints.push({
      id: this.nextCheckpointId++,
      index: this.currentIndex,
      createdAt: Date.now(),
      snapshot: adapter.capture(),
    });
  }

  private refreshCheckpointAtCurrentIndex(): void {
    const adapter = this.snapshotAdapter;
    if (!adapter) return;
    const checkpointIndex = this.checkpoints.findIndex(
      (checkpoint) => checkpoint.index === this.currentIndex,
    );
    if (checkpointIndex < 0) return;
    const checkpoint = this.checkpoints[checkpointIndex];
    this.checkpoints[checkpointIndex] = {
      ...checkpoint,
      createdAt: Date.now(),
      snapshot: adapter.capture(),
    };
  }

  private trimHistory(): void {
    if (this.entries.length <= this.limit) return;

    const overflow = this.entries.length - this.limit;
    const checkpoint = this.checkpoints.find((item) => item.index >= overflow - 1);
    if (!checkpoint) return;

    const removeCount = checkpoint.index + 1;
    this.baseSnapshot = checkpoint.snapshot;
    this.entries.splice(0, removeCount);
    this.currentIndex -= removeCount;
    this.checkpoints = this.checkpoints
      .filter((item) => item.index > checkpoint.index)
      .map((item) => ({
        ...item,
        index: item.index - removeCount,
      }));
  }

  private emit(): void {
    // 重建快照引用，触发 useSyncExternalStore 比较
    this.snapshot = {
      canUndo: this.currentIndex >= 0,
      canRedo: this.currentIndex < this.entries.length - 1,
      version: this.snapshot.version + 1,
      entries: this.entries.map(({ id, name, createdAt }) => ({ id, name, createdAt })),
      currentIndex: this.currentIndex,
      checkpoints: this.checkpoints.map(({ id, index, createdAt }) => ({
        id,
        index,
        createdAt,
      })),
      isJumping: this.isJumping,
    };
    this.listeners.forEach((l) => l());
  }
}
