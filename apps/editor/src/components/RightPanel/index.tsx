import { useMemo } from 'react';
import {
  Collapse,
  Empty,
  Input,
  InputNumber,
  Slider,
  ColorPicker,
  Switch,
  Select,
  Button,
  Typography,
  Space,
} from 'antd';
import type { Color } from 'antd/es/color-picker';
import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import styles from './style.module.scss';

/** 把 antd ColorPicker 的值标准化为 hex 字符串 */
const toHex = (c: Color | string): string => (typeof c === 'string' ? c : c.toHexString());

/** 一行 label + 控件 */
const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <div className={styles.control}>{children}</div>
  </div>
);

/** 类型守卫：是否文本类 widget */
const isTextWidget = (w: Widget): w is Extract<Widget, { type: 'text' | 'i-text' }> =>
  w.type === 'text' || w.type === 'i-text';

const RightPanel = () => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const widget = useEditorStore((s) =>
    selectedIds.length === 1 ? s.widgets[selectedIds[0]!] : undefined,
  );
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const removeWidget = useEditorStore((s) => s.removeWidget);

  /** 统一的属性写入 */
  const patch = (p: Partial<Widget>) => {
    if (!widget) return;
    updateWidget(widget.id, p);
  };

  const items = useMemo(() => {
    if (!widget) return [];

    /** 位置与尺寸 */
    const position = (
      <div className={styles.group}>
        <Row label="X">
          <InputNumber
            size="small"
            value={Math.round(widget.left)}
            onChange={(v) => patch({ left: Number(v ?? 0) })}
          />
        </Row>
        <Row label="Y">
          <InputNumber
            size="small"
            value={Math.round(widget.top)}
            onChange={(v) => patch({ top: Number(v ?? 0) })}
          />
        </Row>
        <Row label="宽">
          <InputNumber
            size="small"
            min={1}
            value={Math.round(widget.width)}
            onChange={(v) => patch({ width: Number(v ?? 1) })}
          />
        </Row>
        <Row label="高">
          <InputNumber
            size="small"
            min={1}
            value={Math.round(widget.height)}
            onChange={(v) => patch({ height: Number(v ?? 1) })}
          />
        </Row>
        <Row label="旋转">
          <Space.Compact size="small">
            <InputNumber
              value={Math.round(widget.angle)}
              onChange={(v) => patch({ angle: Number(v ?? 0) })}
            />
            <Typography.Text
              style={{
                padding: '0 8px',
                border: '1px solid #d9d9d9',
                borderLeft: 0,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              °
            </Typography.Text>
          </Space.Compact>
        </Row>
      </div>
    );

    /** 外观 */
    const appearance = (
      <div className={styles.group}>
        <Row label="填充">
          <ColorPicker
            size="small"
            value={widget.fill ?? '#000000'}
            onChange={(c) => patch({ fill: toHex(c) })}
            showText
          />
        </Row>
        <Row label="描边">
          <ColorPicker
            size="small"
            value={widget.stroke ?? '#000000'}
            onChange={(c) => patch({ stroke: toHex(c) })}
            showText
          />
        </Row>
        <Row label="描边粗细">
          <InputNumber
            size="small"
            min={0}
            value={widget.strokeWidth ?? 0}
            onChange={(v) => patch({ strokeWidth: Number(v ?? 0) })}
          />
        </Row>
        <Row label="不透明度">
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={widget.opacity ?? 1}
            onChange={(v) => patch({ opacity: Number(v) })}
          />
        </Row>
      </div>
    );

    /** 文本（仅文本类显示） */
    const text = isTextWidget(widget) ? (
      <div className={styles.group}>
        <Row label="内容">
          <Input.TextArea
            size="small"
            autoSize={{ minRows: 1, maxRows: 4 }}
            value={widget.text}
            onChange={(e) => patch({ text: e.target.value })}
          />
        </Row>
        <Row label="字号">
          <InputNumber
            size="small"
            min={1}
            value={widget.fontSize ?? 16}
            onChange={(v) => patch({ fontSize: Number(v ?? 16) })}
          />
        </Row>
        <Row label="字重">
          <Select
            size="small"
            value={widget.fontWeight ?? 'normal'}
            onChange={(v) => patch({ fontWeight: v })}
            options={[
              { label: '常规', value: 'normal' },
              { label: '加粗', value: 'bold' },
              { label: '300', value: 300 },
              { label: '500', value: 500 },
              { label: '700', value: 700 },
            ]}
          />
        </Row>
        <Row label="字体">
          <Select
            size="small"
            value={widget.fontFamily ?? 'sans-serif'}
            onChange={(v) => patch({ fontFamily: v })}
            options={[
              { label: 'Sans Serif', value: 'sans-serif' },
              { label: 'Serif', value: 'serif' },
              { label: 'Monospace', value: 'monospace' },
              { label: 'Arial', value: 'Arial' },
              { label: 'Helvetica', value: 'Helvetica' },
            ]}
          />
        </Row>
        <Row label="斜体">
          <Switch
            size="small"
            checked={widget.fontStyle === 'italic'}
            onChange={(b) => patch({ fontStyle: b ? 'italic' : 'normal' })}
          />
        </Row>
        <Row label="下划线">
          <Switch
            size="small"
            checked={!!widget.underline}
            onChange={(b) => patch({ underline: b })}
          />
        </Row>
        <Row label="对齐">
          <Select
            size="small"
            value={widget.textAlign ?? 'left'}
            onChange={(v) => patch({ textAlign: v })}
            options={[
              { label: '左', value: 'left' },
              { label: '中', value: 'center' },
              { label: '右', value: 'right' },
              { label: '两端', value: 'justify' },
            ]}
          />
        </Row>
      </div>
    ) : null;

    /** 高级 */
    const advanced = (
      <div className={styles.group}>
        <Row label="名称">
          <Input
            size="small"
            value={widget.name}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </Row>
        <Row label="锁定">
          <Switch size="small" checked={!!widget.locked} onChange={(b) => patch({ locked: b })} />
        </Row>
        <Row label="可见">
          <Switch
            size="small"
            checked={widget.visible !== false}
            onChange={(b) => patch({ visible: b })}
          />
        </Row>
        <Row label="操作">
          <Button size="small" danger onClick={() => removeWidget(widget.id)}>
            删除
          </Button>
        </Row>
      </div>
    );

    const list = [
      { key: 'position', label: '位置与尺寸', children: position },
      { key: 'appearance', label: '外观', children: appearance },
    ];
    if (text) list.push({ key: 'text', label: '文本', children: text });
    list.push({ key: 'advanced', label: '高级', children: advanced });
    return list;
    // 仅依赖 widget 引用与 selectedIds；patch / remove 来自 store 稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget]);

  /** 头部展示信息 */
  const headerInfo = useMemo(() => {
    if (!widget) {
      return selectedIds.length > 1 ? `已选中 ${selectedIds.length} 个对象` : '';
    }
    return `${widget.name}（${widget.type}）`;
  }, [widget, selectedIds.length]);

  return (
    <div className={styles.panel}>
      <div className={styles.title}>属性配置</div>
      {widget ? (
        <>
          <div className={styles.subTitle}>{headerInfo}</div>
          <Collapse
            items={items}
            defaultActiveKey={['position', 'appearance', 'text', 'advanced']}
            bordered={false}
            size="small"
          />
        </>
      ) : (
        <Empty
          description={selectedIds.length > 1 ? '多选暂不支持属性编辑' : '请选中画布上的元素'}
          className={styles.empty}
        />
      )}
    </div>
  );
};

export default RightPanel;
