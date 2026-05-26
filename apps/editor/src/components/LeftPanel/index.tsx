import { Collapse } from 'antd';
import {
  FontSizeOutlined,
  BorderOutlined,
  PictureOutlined,
  StarOutlined,
  LineOutlined,
} from '@ant-design/icons';
import styles from './style.module.scss';

/** 组件分类配置 - 后续在此扩展具体组件列表 */
const componentCategories = [
  {
    key: 'basic',
    label: '基础图形',
    icon: <BorderOutlined />,
    children: ['矩形', '圆形', '三角形', '多边形'],
  },
  {
    key: 'text',
    label: '文本',
    icon: <FontSizeOutlined />,
    children: ['标题', '正文', '标注'],
  },
  {
    key: 'media',
    label: '媒体',
    icon: <PictureOutlined />,
    children: ['图片', 'SVG'],
  },
  {
    key: 'line',
    label: '线条',
    icon: <LineOutlined />,
    children: ['直线', '箭头', '曲线'],
  },
  {
    key: 'preset',
    label: '预设组件',
    icon: <StarOutlined />,
    children: ['按钮', '卡片', '图标'],
  },
];

const LeftPanel = () => {
  const collapseItems = componentCategories.map((category) => ({
    key: category.key,
    label: (
      <span>
        {category.icon} {category.label}
      </span>
    ),
    children: (
      <div className={styles.grid}>
        {category.children.map((name) => (
          <div className={styles.item} key={name}>
            {name}
          </div>
        ))}
      </div>
    ),
  }));

  return (
    <div className={styles.panel}>
      <div className={styles.title}>组件库</div>
      <Collapse items={collapseItems} defaultActiveKey={['basic']} bordered={false} size="small" />
    </div>
  );
};

export default LeftPanel;
