import { CheckOutlined, HistoryOutlined, SaveOutlined } from '@ant-design/icons';
import { Empty } from 'antd';
import { history, useHistory } from '@/core/history';
import styles from './style.module.scss';

const HISTORY_LABELS: Record<string, string> = {
  AddWidget: '添加元素',
  RemoveWidget: '删除元素',
  PatchWidgets: '修改属性',
  ReorderWidget: '调整图层',
  GroupWidgets: '编组',
  UngroupWidget: '取消编组',
  ApplyGroupLayout: '应用组布局',
};

function getHistoryLabel(name: string): string {
  return HISTORY_LABELS[name] ?? name;
}

function HistoryPanel() {
  const { checkpoints, entries, currentIndex, isJumping } = useHistory();
  const checkpointIndices = new Set(checkpoints.map((checkpoint) => checkpoint.index));

  if (entries.length === 0) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无历史操作" />;
  }

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={`${styles.item} ${currentIndex === -1 ? styles.current : ''}`}
        disabled={isJumping}
        onClick={() => history.goTo(-1)}
      >
        <span className={styles.icon}>
          {currentIndex === -1 ? <CheckOutlined /> : <HistoryOutlined />}
        </span>
        <span className={styles.content}>
          <span className={styles.name}>初始状态</span>
        </span>
      </button>

      {entries.map((entry, index) => {
        const isCurrent = index === currentIndex;
        const isFuture = index > currentIndex;
        const isCheckpoint = checkpointIndices.has(index);

        return (
          <button
            type="button"
            className={[styles.item, isCurrent ? styles.current : '', isFuture ? styles.future : '']
              .filter(Boolean)
              .join(' ')}
            key={entry.id}
            disabled={isJumping}
            onClick={() => history.goTo(index)}
          >
            <span className={styles.icon}>
              {isCurrent ? (
                <CheckOutlined />
              ) : isCheckpoint ? (
                <SaveOutlined />
              ) : (
                <span className={styles.dot} />
              )}
            </span>
            <span className={styles.content}>
              <span className={styles.name}>
                {getHistoryLabel(entry.name)}
                {isCheckpoint ? <span className={styles.checkpoint}>关键帧</span> : null}
              </span>
              <span className={styles.time}>
                {new Date(entry.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </span>
          </button>
        );
      })}
      {isJumping ? <div className={styles.status}>正在恢复历史状态...</div> : null}
    </div>
  );
}

export default HistoryPanel;
