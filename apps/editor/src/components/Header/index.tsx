import { useState } from 'react';
import { Button, Space, Tooltip } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  SaveOutlined,
  ExportOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useEditorStore } from '@/store';
import { history, useHistory } from '@/core/history';
import ShortcutPanel from '@/components/ShortcutPanel';
import styles from './style.module.scss';

const Header = () => {
  // 通过 useSyncExternalStore 订阅 HistoryManager
  const { canUndo, canRedo } = useHistory();
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const [shortcutPanelOpen, setShortcutPanelOpen] = useState(false);

  const handleDelete = () => {
    selectedIds.forEach((id) => removeWidget(id));
  };

  return (
    <div className={styles.header}>
      <div className={styles.left}>
        <span className={styles.title}>Fabric Editor</span>
      </div>
      <div className={styles.center}>
        <Space>
          <Tooltip title="撤销 (Cmd/Ctrl+Z)">
            <Button
              icon={<UndoOutlined />}
              type="text"
              disabled={!canUndo}
              onClick={history.undo}
            />
          </Tooltip>
          <Tooltip title="重做 (Cmd/Ctrl+Shift+Z)">
            <Button
              icon={<RedoOutlined />}
              type="text"
              disabled={!canRedo}
              onClick={history.redo}
            />
          </Tooltip>
          <Tooltip title="放大">
            <Button icon={<ZoomInOutlined />} type="text" />
          </Tooltip>
          <Tooltip title="缩小">
            <Button icon={<ZoomOutOutlined />} type="text" />
          </Tooltip>
          <Tooltip title="删除">
            <Button
              icon={<DeleteOutlined />}
              type="text"
              danger
              disabled={selectedIds.length === 0}
              onClick={handleDelete}
            />
          </Tooltip>
        </Space>
      </div>
      <div className={styles.right}>
        <Space>
          <Tooltip title="快捷键">
            <Button icon={<KeyOutlined />} type="text" onClick={() => setShortcutPanelOpen(true)} />
          </Tooltip>
          <Button icon={<SaveOutlined />}>保存</Button>
          <Button icon={<ExportOutlined />} type="primary">
            导出
          </Button>
        </Space>
      </div>
      <ShortcutPanel open={shortcutPanelOpen} onClose={() => setShortcutPanelOpen(false)} />
    </div>
  );
};

export default Header;
