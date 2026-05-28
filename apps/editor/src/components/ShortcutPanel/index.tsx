import { Empty, Modal, Table, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { commandManager } from '@/core/command';
import { shortcutManager } from '@/core/shortcut';
import styles from './style.module.scss';

interface ShortcutPanelProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  key: string;
  commandId: string;
  commandTitle: string;
  category: string;
  scope: string;
  keys: string[];
}

const categoryNameMap: Record<string, string> = {
  editor: '编辑器',
  widget: '组件',
  layer: '图层',
  canvas: '画布',
  text: '文本',
  page: '页面',
};

const modifierLabelMap: Record<string, string> = {
  command: '⌘',
  meta: '⌘',
  ctrl: 'Ctrl',
  control: 'Ctrl',
  shift: 'Shift',
  alt: 'Alt',
  option: 'Option',
};

function isMacPlatform(): boolean {
  return /mac|iphone|ipad|ipod/i.test(navigator.platform);
}

function getCategory(commandId: string): string {
  const domain = commandId.split('.')[0] ?? commandId;
  return categoryNameMap[domain] ?? domain;
}

function hasCommandModifier(key: string): boolean {
  return key
    .toLowerCase()
    .split('+')
    .some((part) => part.trim() === 'command' || part.trim() === 'meta');
}

function hasCtrlModifier(key: string): boolean {
  return key
    .toLowerCase()
    .split('+')
    .some((part) => part.trim() === 'ctrl' || part.trim() === 'control');
}

/**
 * 根据当前系统过滤快捷键展示项。
 *
 * @param keys 同一个命令绑定的快捷键列表，比如 command+z、ctrl+z。
 * @param isMac 当前系统是否为 macOS / iOS。
 * @returns 当前系统优先展示的快捷键；没有平台专属替代项时保留原列表。
 */
function filterKeysForPlatform(keys: string[], isMac: boolean): string[] {
  const platformKeys = keys.filter((key) =>
    isMac ? !hasCtrlModifier(key) : !hasCommandModifier(key),
  );
  return platformKeys.length > 0 ? platformKeys : keys;
}

/**
 * 把内部快捷键字符串转换为适合用户阅读的展示文本。
 *
 * @param key 单个快捷键组合，比如 command+z、ctrl+shift+z。
 * @returns 格式化后的快捷键文本，比如 ⌘ + Z、Ctrl + Shift + Z。
 */
function formatShortcutKey(key: string): string {
  return key
    .split('+')
    .map((part) => {
      const normalized = part.trim().toLowerCase();
      return modifierLabelMap[normalized] ?? part.toUpperCase();
    })
    .join(' + ');
}

/**
 * 从 CommandManager 和 ShortcutManager 生成快捷键面板表格数据。
 *
 * @param isMac 当前系统是否为 macOS / iOS。
 * @returns 当前已经注册的快捷键展示行。
 */
function createShortcutRows(isMac: boolean): ShortcutRow[] {
  return shortcutManager.list().map((binding) => {
    const command = commandManager.get(binding.commandId);
    const keys = binding.keys.split(',').filter(Boolean);
    return {
      key: `${binding.scope}-${binding.commandId}-${binding.keys}`,
      commandId: binding.commandId,
      commandTitle: command?.title ?? binding.commandId,
      category: getCategory(binding.commandId),
      scope: binding.scope,
      keys: filterKeysForPlatform(keys, isMac),
    };
  });
}

const columns: ColumnsType<ShortcutRow> = [
  {
    title: '分类',
    dataIndex: 'category',
    width: 96,
    render: (category: string) => <Tag>{category}</Tag>,
  },
  {
    title: '命令',
    dataIndex: 'commandTitle',
    width: 160,
  },
  {
    title: '命令 ID',
    dataIndex: 'commandId',
    render: (commandId: string) => <span className={styles.commandId}>{commandId}</span>,
  },
  {
    title: '作用域',
    dataIndex: 'scope',
    width: 96,
    render: (scope: string) => <Tag color={scope === 'global' ? 'blue' : 'purple'}>{scope}</Tag>,
  },
  {
    title: '快捷键',
    dataIndex: 'keys',
    width: 220,
    render: (keys: string[]) => (
      <div className={styles.keys}>
        {keys.map((key) => (
          <kbd className={styles.key} key={key}>
            {formatShortcutKey(key)}
          </kbd>
        ))}
      </div>
    ),
  },
];

const ShortcutPanel = ({ open, onClose }: ShortcutPanelProps) => {
  const rows = open ? createShortcutRows(isMacPlatform()) : [];

  return (
    <Modal centered footer={null} open={open} title="快捷键" width={760} onCancel={onClose}>
      {rows.length > 0 ? (
        <Table
          columns={columns}
          dataSource={rows}
          pagination={false}
          rowKey="key"
          size="small"
          scroll={{ y: 420 }}
        />
      ) : (
        <Empty description="暂无快捷键" />
      )}
    </Modal>
  );
};

export default ShortcutPanel;
