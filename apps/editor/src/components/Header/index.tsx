import { useState } from 'react';
import { Button, Select, Space, Tooltip, Typography } from 'antd';
import {
  UndoOutlined,
  RedoOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  SaveOutlined,
  ExportOutlined,
  DeleteOutlined,
  KeyOutlined,
} from '@ant-design/icons';
import { useEditorStore } from '@/store';
import type { CanvasAspect } from '@/store';
import { history, useHistory } from '@/core/history';
import ShortcutPanel from '@/components/ShortcutPanel';
import styles from './style.module.scss';

const Header = () => {
  // 通过 useSyncExternalStore 订阅 HistoryManager
  const { canUndo, canRedo } = useHistory();
  const removeWidget = useEditorStore((s) => s.removeWidget);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const page = useEditorStore((s) => s.pages[s.activePageId]);
  const zoom = useEditorStore((s) => s.zoom);
  const setZoom = useEditorStore((s) => s.setZoom);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const setPageAspect = useEditorStore((s) => s.setPageAspect);
  const [shortcutPanelOpen, setShortcutPanelOpen] = useState(false);

  const handleDelete = () => {
    selectedIds.forEach((id) => removeWidget(id));
  };

  const aspect: CanvasAspect = page && page.width / page.height > 1.5 ? '16:9' : '4:3';

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
            <Button icon={<ZoomInOutlined />} type="text" onClick={zoomIn} />
          </Tooltip>
          <Tooltip title="缩小">
            <Button icon={<ZoomOutOutlined />} type="text" onClick={zoomOut} />
          </Tooltip>
          <Tooltip title="适应窗口">
            <Button icon={<ExpandOutlined />} type="text" onClick={() => setZoom(zoom, 'fit')} />
          </Tooltip>
          <Typography.Text type="secondary" style={{ minWidth: 44, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography.Text>
          <Select
            size="small"
            value={aspect}
            style={{ width: 84 }}
            options={[
              { label: '16:9', value: '16:9' },
              { label: '4:3', value: '4:3' },
            ]}
            onChange={(value) => setPageAspect(value)}
          />
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
