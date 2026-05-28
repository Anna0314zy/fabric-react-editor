import { Button, Collapse, Empty, Tabs, Tooltip } from 'antd';
import {
  AppstoreOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  FontSizeOutlined,
  BorderOutlined,
  LockOutlined,
  OrderedListOutlined,
  PictureOutlined,
  StarOutlined,
  LineOutlined,
  UnlockOutlined,
} from '@ant-design/icons';
import { useEditorStore } from '@/store';
import { createWidgetByType } from '@/core/canvas/createWidget';
import type { Widget, WidgetType } from '@/types/widget';
import styles from './style.module.scss';

interface ComponentItem {
  label: string;
  /** 可点击落地的类型；undefined 表示本期未实现，仅占位展示 */
  type?: WidgetType;
}

interface ComponentCategory {
  key: string;
  label: string;
  icon: React.ReactNode;
  children: ComponentItem[];
}

/** 组件分类配置 */
const componentCategories: ComponentCategory[] = [
  {
    key: 'basic',
    label: '基础图形',
    icon: <BorderOutlined />,
    children: [
      { label: '矩形', type: 'rect' },
      { label: '圆形', type: 'circle' },
      { label: '三角形' },
      { label: '多边形' },
    ],
  },
  {
    key: 'text',
    label: '文本',
    icon: <FontSizeOutlined />,
    children: [{ label: '标题', type: 'text' }, { label: '正文', type: 'text' }, { label: '标注' }],
  },
  {
    key: 'media',
    label: '媒体',
    icon: <PictureOutlined />,
    children: [{ label: '图片' }, { label: 'SVG' }],
  },
  {
    key: 'line',
    label: '线条',
    icon: <LineOutlined />,
    children: [{ label: '直线' }, { label: '箭头' }, { label: '曲线' }],
  },
  {
    key: 'preset',
    label: '预设组件',
    icon: <StarOutlined />,
    children: [{ label: '按钮' }, { label: '卡片' }, { label: '图标' }],
  },
];

const LeftPanel = () => {
  const activePageId = useEditorStore((s) => s.activePageId);
  const widgets = useEditorStore((s) => s.widgets);
  const rootIds = useEditorStore((s) => s.rootIds[activePageId] ?? []);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const setSelectedIds = useEditorStore((s) => s.setSelectedIds);
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const reorderWidget = useEditorStore((s) => s.reorderWidget);

  /** 点击 -> 在画布中心生成默认 widget 并 dispatch */
  const handleAdd = (type?: WidgetType) => {
    if (!type) return;
    const state = useEditorStore.getState();
    const page = state.pages[state.activePageId];
    if (!page) return;
    const widget = createWidgetByType(type, page);
    if (!widget) return;
    state.addWidget(widget);
  };

  const handleSelectLayer = (id: string) => {
    setSelectedIds([id]);
  };

  const handleMoveLayer = (id: string, direction: 'up' | 'down') => {
    const from = rootIds.indexOf(id);
    if (from === -1) return;
    const to = direction === 'up' ? from + 1 : from - 1;
    reorderWidget(activePageId, from, to);
  };

  const handleToggleVisible = (widget: Widget) => {
    updateWidget(widget.id, { visible: widget.visible === false });
  };

  const handleToggleLocked = (widget: Widget) => {
    updateWidget(widget.id, { locked: !widget.locked });
  };

  const collapseItems = componentCategories.map((category) => ({
    key: category.key,
    label: (
      <span>
        {category.icon} {category.label}
      </span>
    ),
    children: (
      <div className={styles.grid}>
        {category.children.map((item) => (
          <div
            className={`${styles.item} ${item.type ? '' : styles.disabled}`}
            key={item.label}
            onClick={() => handleAdd(item.type)}
          >
            {item.label}
          </div>
        ))}
      </div>
    ),
  }));

  const layerItems = rootIds
    .map((id) => widgets[id])
    .filter((widget): widget is Widget => !!widget)
    .reverse();

  const renderLayerName = (widget: Widget) => {
    const name = widget.name.trim() || '未命名图层';
    return (
      <div className={styles.layerMeta}>
        <span className={styles.layerName}>{name}</span>
        <span className={styles.layerType}>{widget.type}</span>
      </div>
    );
  };

  const componentPanel = (
    <>
      <div className={styles.title}>组件库</div>
      <Collapse items={collapseItems} defaultActiveKey={['basic']} bordered={false} size="small" />
    </>
  );

  const layerPanel = (
    <>
      <div className={styles.title}>图层</div>
      {layerItems.length > 0 ? (
        <div className={styles.layerList}>
          {layerItems.map((widget) => {
            const sourceIndex = rootIds.indexOf(widget.id);
            const isSelected = selectedIds.includes(widget.id);
            const isHidden = widget.visible === false;
            const isLocked = !!widget.locked;

            return (
              <div
                className={`${styles.layerItem} ${isSelected ? styles.selectedLayer : ''}`}
                key={widget.id}
                onClick={() => handleSelectLayer(widget.id)}
              >
                {renderLayerName(widget)}
                <div className={styles.layerActions}>
                  <Tooltip title={isHidden ? '显示' : '隐藏'}>
                    <Button
                      aria-label={isHidden ? '显示图层' : '隐藏图层'}
                      icon={isHidden ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                      size="small"
                      type="text"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleVisible(widget);
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={isLocked ? '解锁' : '锁定'}>
                    <Button
                      aria-label={isLocked ? '解锁图层' : '锁定图层'}
                      icon={isLocked ? <LockOutlined /> : <UnlockOutlined />}
                      size="small"
                      type="text"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleToggleLocked(widget);
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="上移">
                    <Button
                      aria-label="上移图层"
                      disabled={sourceIndex >= rootIds.length - 1}
                      icon={<ArrowUpOutlined />}
                      size="small"
                      type="text"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMoveLayer(widget.id, 'up');
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="下移">
                    <Button
                      aria-label="下移图层"
                      disabled={sourceIndex <= 0}
                      icon={<ArrowDownOutlined />}
                      size="small"
                      type="text"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleMoveLayer(widget.id, 'down');
                      }}
                    />
                  </Tooltip>
                  <Tooltip title="删除">
                    <Button
                      aria-label="删除图层"
                      danger
                      icon={<DeleteOutlined />}
                      size="small"
                      type="text"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeWidget(widget.id);
                      }}
                    />
                  </Tooltip>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <Empty description="当前页面暂无图层" className={styles.empty} />
      )}
    </>
  );

  return (
    <div className={styles.panel}>
      <Tabs
        className={styles.tabs}
        defaultActiveKey="components"
        items={[
          {
            key: 'components',
            label: (
              <span>
                <AppstoreOutlined /> 组件
              </span>
            ),
            children: componentPanel,
          },
          {
            key: 'layers',
            label: (
              <span>
                <OrderedListOutlined /> 图层
              </span>
            ),
            children: layerPanel,
          },
        ]}
      />
    </div>
  );
};

export default LeftPanel;
