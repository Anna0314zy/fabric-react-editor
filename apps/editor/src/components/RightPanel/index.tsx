import { useCallback, useEffect, useMemo, useState } from 'react';
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

interface BufferedNumberProps {
  min?: number;
  value: number;
  onCommit: (value: number) => void;
}

const BufferedNumber = ({ min, value, onCommit }: BufferedNumberProps) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    onCommit(Number(draft ?? min ?? 0));
  }, [draft, min, onCommit]);

  return (
    <InputNumber
      size="small"
      min={min}
      value={draft}
      onBlur={commit}
      onChange={(v) => setDraft(Number(v ?? min ?? 0))}
      onPressEnter={commit}
    />
  );
};

interface BufferedTextProps {
  value: string;
  onCommit: (value: string) => void;
}

const BufferedInput = ({ value, onCommit }: BufferedTextProps) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = useCallback(() => {
    onCommit(draft);
  }, [draft, onCommit]);

  return (
    <Input
      size="small"
      value={draft}
      onBlur={commit}
      onChange={(event) => setDraft(event.target.value)}
      onPressEnter={commit}
    />
  );
};

const BufferedTextArea = ({ value, onCommit }: BufferedTextProps) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Input.TextArea
      size="small"
      autoSize={{ minRows: 1, maxRows: 4 }}
      value={draft}
      onBlur={() => onCommit(draft)}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
};

interface BufferedSliderProps {
  value: number;
  onCommit: (value: number) => void;
}

const BufferedSlider = ({ value, onCommit }: BufferedSliderProps) => {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  return (
    <Slider
      min={0}
      max={1}
      step={0.01}
      value={draft}
      onChange={(v) => setDraft(Number(v))}
      onChangeComplete={(v) => onCommit(Number(v))}
    />
  );
};

const RightPanel = () => {
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const widget = useEditorStore((s) =>
    selectedIds.length === 1 ? s.widgets[selectedIds[0]!] : undefined,
  );
  const updateWidget = useEditorStore((s) => s.updateWidget);
  const removeWidget = useEditorStore((s) => s.removeWidget);

  /** 统一的属性写入 */
  const patch = useCallback(
    (p: Partial<Widget>) => {
      if (!widget) return;
      updateWidget(widget.id, p);
    },
    [updateWidget, widget],
  );

  const items = useMemo(() => {
    if (!widget) return [];

    /** 位置与尺寸 */
    const position = (
      <div className={styles.group}>
        <Row label="X">
          <BufferedNumber value={Math.round(widget.left)} onCommit={(v) => patch({ left: v })} />
        </Row>
        <Row label="Y">
          <BufferedNumber value={Math.round(widget.top)} onCommit={(v) => patch({ top: v })} />
        </Row>
        <Row label="宽">
          <BufferedNumber
            min={1}
            value={Math.round(widget.width)}
            onCommit={(v) => patch({ width: v })}
          />
        </Row>
        <Row label="高">
          <BufferedNumber
            min={1}
            value={Math.round(widget.height)}
            onCommit={(v) => patch({ height: v })}
          />
        </Row>
        <Row label="旋转">
          <Space.Compact size="small">
            <BufferedNumber
              value={Math.round(widget.angle)}
              onCommit={(v) => patch({ angle: v })}
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
            onChangeComplete={(c) => patch({ fill: toHex(c) })}
            showText
          />
        </Row>
        <Row label="描边">
          <ColorPicker
            size="small"
            value={widget.stroke ?? '#000000'}
            onChangeComplete={(c) => patch({ stroke: toHex(c) })}
            showText
          />
        </Row>
        <Row label="描边粗细">
          <BufferedNumber
            min={0}
            value={widget.strokeWidth ?? 0}
            onCommit={(v) => patch({ strokeWidth: v })}
          />
        </Row>
        <Row label="不透明度">
          <BufferedSlider value={widget.opacity ?? 1} onCommit={(v) => patch({ opacity: v })} />
        </Row>
      </div>
    );

    /** 文本（仅文本类显示） */
    const text = isTextWidget(widget) ? (
      <div className={styles.group}>
        <Row label="内容">
          <BufferedTextArea value={widget.text} onCommit={(v) => patch({ text: v })} />
        </Row>
        <Row label="字号">
          <BufferedNumber
            min={1}
            value={widget.fontSize ?? 16}
            onCommit={(v) => patch({ fontSize: v })}
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
          <BufferedInput value={widget.name} onCommit={(v) => patch({ name: v })} />
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
  }, [patch, removeWidget, widget]);

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
