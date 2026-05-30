/**
 * 历史命令接口
 * - execute / undo 内部直接读写 store
 * - merge 只用于调用方明确声明为同一次用户动作的连续更新
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
