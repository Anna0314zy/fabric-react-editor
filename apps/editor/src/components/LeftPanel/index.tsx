import { Collapse, Tabs } from 'antd';
import {
  AppstoreOutlined,
  FontSizeOutlined,
  BorderOutlined,
  OrderedListOutlined,
  PictureOutlined,
  StarOutlined,
  LineOutlined,
} from '@ant-design/icons';
import { useEditorStore } from '@/store';
import { createWidgetByType } from '@/core/canvas/createWidget';
import type { WidgetType } from '@/types/widget';
import LayerPanel from './LayerPanel';
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

  const componentPanel = (
    <>
      <div className={styles.title}>组件库</div>
      <Collapse items={collapseItems} defaultActiveKey={['basic']} bordered={false} size="small" />
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
            children: <LayerPanel />,
          },
        ]}
      />
    </div>
  );
};

export default LeftPanel;
