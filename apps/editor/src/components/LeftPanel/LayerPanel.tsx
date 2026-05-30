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
import type { Widget } from '@/types/widget';
import styles from './style.module.scss';

const LAYER_ROW_HEIGHT = 48;
const LAYER_VIEWPORT_HEIGHT = 520;
const LAYER_OVERSCAN = 6;

interface LayerRowProps {
  widgetId: string;
  sourceIndex?: number;
  rootCount?: number;
  virtualIndex: number;
  depth: number;
  isRoot: boolean;
}

interface LayerTreeItem {
  id: string;
  depth: number;
  rootIndex?: number;
  isRoot: boolean;
}

const buildLayerTree = (
  rootIds: string[],
  widgets: Record<string, Widget>,
  childIds: Record<string, string[]>,
): LayerTreeItem[] => {
  const result: LayerTreeItem[] = [];

  const visit = (id: string, depth: number, rootIndex?: number) => {
    const widget = widgets[id];
    if (!widget) return;
    result.push({ id, depth, rootIndex, isRoot: depth === 0 });

    if (widget.type !== 'group') return;
    const children = childIds[id] ?? widget.childrenIds;
    children.forEach((childId) => visit(childId, depth + 1));
  };

  [...rootIds].reverse().forEach((id) => visit(id, 0, rootIds.indexOf(id)));
  return result;
};

const LayerRow = ({
  widgetId,
  sourceIndex,
  rootCount,
  virtualIndex,
  depth,
  isRoot,
}: LayerRowProps) => {
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
    if (sourceIndex === undefined) return;
    const to = direction === 'up' ? sourceIndex + 1 : sourceIndex - 1;
    reorderWidget(activePageId, sourceIndex, to);
  };
  const canMoveLayer = isRoot && sourceIndex !== undefined && rootCount !== undefined;
  const disableMoveUp = !canMoveLayer || sourceIndex! >= rootCount! - 1;
  const disableMoveDown = !canMoveLayer || sourceIndex! <= 0;

  return (
    <div
      className={styles.layerVirtualRow}
      style={{ transform: `translateY(${virtualIndex * LAYER_ROW_HEIGHT}px)` }}
    >
      <div
        className={`${styles.layerItem} ${isSelected ? styles.selectedLayer : ''} ${
          isRoot ? '' : styles.childLayer
        }`}
        onClick={() => {
          if (isRoot) setSelectedIds([widgetId]);
        }}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <div className={styles.layerMeta}>
          <span className={styles.layerName}>{name}</span>
          <span className={styles.layerType}>{widget.type}</span>
        </div>
        <div className={styles.layerState}>
          {isHidden ? <EyeInvisibleOutlined /> : null}
          {isLocked ? <LockOutlined /> : null}
        </div>
        {isRoot ? (
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
              disabled={disableMoveUp}
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
              disabled={disableMoveDown}
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
        ) : null}
      </div>
    </div>
  );
};

const LayerPanel = () => {
  const activePageId = useEditorStore((s) => s.activePageId);
  const rootIds = useEditorStore((s) => s.rootIds[activePageId] ?? []);
  const widgets = useEditorStore((s) => s.widgets);
  const childIds = useEditorStore((s) => s.childIds);
  const [scrollTop, setScrollTop] = useState(0);

  const layerTree = useMemo(() => {
    return buildLayerTree(rootIds, widgets, childIds);
  }, [childIds, rootIds, widgets]);
  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / LAYER_ROW_HEIGHT) - LAYER_OVERSCAN);
    const end = Math.min(
      layerTree.length,
      Math.ceil((scrollTop + LAYER_VIEWPORT_HEIGHT) / LAYER_ROW_HEIGHT) + LAYER_OVERSCAN,
    );
    return { start, end };
  }, [layerTree.length, scrollTop]);
  const visibleItems = layerTree.slice(visibleRange.start, visibleRange.end);

  return (
    <>
      {layerTree.length > 0 ? (
        <div
          className={styles.layerViewport}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        >
          <div
            className={styles.layerVirtualInner}
            style={{ height: layerTree.length * LAYER_ROW_HEIGHT }}
          >
            {visibleItems.map((item, offset) => {
              const virtualIndex = visibleRange.start + offset;
              return (
                <LayerRow
                  key={item.id}
                  depth={item.depth}
                  isRoot={item.isRoot}
                  rootCount={rootIds.length}
                  sourceIndex={item.rootIndex}
                  virtualIndex={virtualIndex}
                  widgetId={item.id}
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
