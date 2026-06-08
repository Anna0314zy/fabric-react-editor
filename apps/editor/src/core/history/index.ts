import { useSyncExternalStore } from 'react';
import { HistoryManager, type HistorySnapshot } from './manager';

/** 全局历史单例：所有历史相关数据/操作均从此处对外暴露 */
export const history = HistoryManager.getInstance();

/**
 * React 桥接：订阅历史栈状态
 * - 基于 useSyncExternalStore，实现 React 与 HistoryManager 解耦
 * - 返回的 snapshot 包含 canUndo / canRedo / version
 */
export function useHistory(): HistorySnapshot {
  return useSyncExternalStore(history.subscribe, history.getSnapshot, history.getSnapshot);
}

interface HistoryControlsSnapshot {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

let historyControlsSnapshot: HistoryControlsSnapshot = {
  canUndo: history.getSnapshot().canUndo,
  canRedo: history.getSnapshot().canRedo,
};

function getHistoryControlsSnapshot(): HistoryControlsSnapshot {
  const { canUndo, canRedo } = history.getSnapshot();
  if (historyControlsSnapshot.canUndo !== canUndo || historyControlsSnapshot.canRedo !== canRedo) {
    historyControlsSnapshot = { canUndo, canRedo };
  }
  return historyControlsSnapshot;
}

/**
 * 只订阅撤销 / 重做按钮真正需要的状态。
 * 拖拽结束会写入 history.version，但如果 canUndo / canRedo 没变，Header 不需要重渲染。
 */
export function useHistoryControls(): HistoryControlsSnapshot {
  return useSyncExternalStore(
    history.subscribe,
    getHistoryControlsSnapshot,
    getHistoryControlsSnapshot,
  );
}

export { HistoryManager } from './manager';
export type { HistoryCheckpoint, HistoryEntry, HistorySnapshot } from './manager';
export type { EditorDocumentSnapshot, HistorySnapshotAdapter } from './snapshot';
export type { Command } from './types';
