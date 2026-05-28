/**
 * 历史命令接口
 * - execute / undo 内部直接读写 store
 * - merge 用于连续小操作合并（如拖拽时的 move），返回非 null 时替换栈顶命令
 */
export interface Command {
  /** 命令名称，用于调试与 merge 类型判断 */
  readonly name: string;
  /** 正向执行 */
  execute(): void;
  /** 反向执行 */
  undo(): void;
  /** 可选：与上一个命令合并 */
  merge?(prev: Command): Command | null;
}
