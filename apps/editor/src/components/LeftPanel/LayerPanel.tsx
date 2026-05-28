import { useMemo, useState } from 'react';
import { Button, Empty } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useEditorStore } from '@/store';
import styles from './style.module.scss';

const LAYER_ROW_HEIGHT = 48;
const LAYER_VIEWPORT_HEIGHT = 520;
const LAYER_OVERSCAN = 6;

interface LayerRowProps {
  widgetId: string;
  sourceIndex: number;
  rootCount: number;
  virtualIndex: number;
}

const LayerRow = ({ widgetId, sourceIndex, rootCount, virtualIndex }: LayerRowProps) => {
  const activePageId = useEditorStore((s) => s.activePageId);
  const widget = useEditorStore((s) => s.widgets[widgetId]);
  const isSelected = useEditorStore((s) => s.selectedIds.includes(widgetId));
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const reorderWidget = useEditorStore((s) => s.reorderWidget);

  if (!widget) return null;

  const name = widget.name.trim() || '未命名图层';
  const isHidden = widget.visible === false;
  const isLocked = !!widget.locked;

  const handleMoveLayer = (direction: 'up' | 'down') => {
    const to = direction === 'up' ? sourceIndex + 1 : sourceIndex - 1;
    reorderWidget(activePageId, sourceIndex, to);
  };

  return (
    <div
      className={styles.layerVirtualRow}
      style={{ transform: `translateY(${virtualIndex * LAYER_ROW_HEIGHT}px)` }}
    >
      <div
        className={`${styles.layerItem} ${isSelected ? styles.selectedLayer : ''}`}
        onClick={() => setSelectedIds([widgetId])}
      >
        <div className={styles.layerMeta}>
          <span className={styles.layerName}>{name}</span>
          <span className={styles.layerType}>{widget.type}</span>
        </div>
        <div className={styles.layerState}>
          {isHidden ? <EyeInvisibleOutlined /> : null}
          {isLocked ? <LockOutlined /> : null}
        </div>
        <div className={styles.layerActions}>
          <Button
            title={isHidden ? '显示' : '隐藏'}
            aria-label={isHidden ? '显示图层' : '隐藏图层'}
            icon={isHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation();
              updateWidget(widgetId, { visible: isHidden });
            }}
          />
          <Button
            title={isLocked ? '解锁' : '锁定'}
            aria-label={isLocked ? '解锁图层' : '锁定图层'}
            icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation();
              updateWidget(widgetId, { locked: !isLocked });
            }}
          />
          <Button
            title="上移"
            aria-label="上移图层"
            disabled={sourceIndex >= rootCount - 1}
            icon={<ArrowUpOutlined />}
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation();
              handleMoveLayer('up');
            }}
          />
          <Button
            title="下移"
            aria-label="下移图层"
            disabled={sourceIndex <= 0}
            icon={<ArrowDownOutlined />}
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation();
              handleMoveLayer('down');
            }}
          />
          <Button
            title="删除"
            aria-label="删除图层"
            danger
            icon={<DeleteOutlined />}
            size="small"
            type="text"
            onClick={(event) => {
              event.stopPropagation();
              removeWidget(widgetId);
            }}
          />
        </div>
      </div>
    </div>
  );
};

const LayerPanel = () => {
  const activePageId = useEditorStore((s) => s.activePageId);
  const rootIds = useEditorStore((s) => s.rootIds[activePageId] ?? []);
  const [scrollTop, setScrollTop] = useState(0);

  const reversedIds = useMemo(() => [...rootIds].reverse(), [rootIds]);
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / LAYER_ROW_HEIGHT) - LAYER_OVERSCAN);
    const end = Math.min(
      reversedIds.length,
      Math.ceil((scrollTop + LAYER_VIEWPORT_HEIGHT) / LAYER_ROW_HEIGHT) + LAYER_OVERSCAN,
    );
    return { start, end };
  }, [reversedIds.length, scrollTop]);
  const visibleIds = reversedIds.slice(visibleRange.start, visibleRange.end);

  return (
    <>
      <div className={styles.title}>图层</div>
      {reversedIds.length > 0 ? (
        <div
          className={styles.layerViewport}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div
            className={styles.layerVirtualInner}
            style={{ height: reversedIds.length * LAYER_ROW_HEIGHT }}
          >
            {visibleIds.map((widgetId, offset) => {
              const virtualIndex = visibleRange.start + offset;
              return (
                <LayerRow
                  key={widgetId}
                  rootCount={rootIds.length}
                  sourceIndex={rootIds.length - 1 - virtualIndex}
                  virtualIndex={virtualIndex}
                  widgetId={widgetId}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <Empty description="当前页面暂无图层" className={styles.empty} />
      )}
    </>
  );
};

export default LayerPanel;
