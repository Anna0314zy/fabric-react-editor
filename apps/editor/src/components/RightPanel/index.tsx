import { Collapse, Empty } from 'antd';
import styles from './style.module.scss';

/** 属性面板 - 展示选中对象的可配置属性 */
const RightPanel = () => {
  // TODO: 从 store 获取当前选中对象
  const selectedObject = null;

  const propertyItems = [
    {
      key: 'position',
      label: '位置与尺寸',
      children: <div className={styles.group}>{/* X, Y, Width, Height, Rotation */}</div>,
    },
    {
      key: 'appearance',
      label: '外观',
      children: <div className={styles.group}>{/* Fill, Stroke, Opacity, Shadow */}</div>,
    },
    {
      key: 'text',
      label: '文本',
      children: <div className={styles.group}>{/* FontFamily, FontSize, Color, Align */}</div>,
    },
    {
      key: 'advanced',
      label: '高级',
      children: <div className={styles.group}>{/* Lock, Visible, Name */}</div>,
    },
  ];

  return (
    <div className={styles.panel}>
      <div className={styles.title}>属性配置</div>
      {selectedObject ? (
        <Collapse
          items={propertyItems}
          defaultActiveKey={['position', 'appearance']}
          bordered={false}
          size="small"
        />
      ) : (
        <Empty description="请选中画布上的元素" className={styles.empty} />
      )}
    </div>
  );
};

export default RightPanel;
