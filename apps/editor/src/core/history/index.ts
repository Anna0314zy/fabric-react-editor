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

export { HistoryManager } from './manager';
export type { HistorySnapshot } from './manager';
export type { Command } from './types';
