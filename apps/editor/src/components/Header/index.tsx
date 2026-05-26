import { Button, Space, Tooltip } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  SaveOutlined,
  ExportOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import styles from './style.module.scss';

const Header = () => {
  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.title}>Fabric Editor</span>
      </div>
      <div className={styles.center}>
        <Space>
          <Tooltip title="撤销">
            <Button icon={<UndoOutlined />} type="text" />
          </Tooltip>
          <Tooltip title="重做">
            <Button icon={<RedoOutlined />} type="text" />
          </Tooltip>
          <Tooltip title="放大">
            <Button icon={<ZoomInOutlined />} type="text" />
          </Tooltip>
          <Tooltip title="缩小">
            <Button icon={<ZoomOutOutlined />} type="text" />
          </Tooltip>
          <Tooltip title="删除">
            <Button icon={<DeleteOutlined />} type="text" danger />
          </Tooltip>
        </Space>
      </div>
      <div className={styles.right}>
        <Space>
          <Button icon={<SaveOutlined />}>保存</Button>
          <Button icon={<ExportOutlined />} type="primary">
            导出
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default Header;
