import { useCallback, useEffect, useMemo, useRef } from 'react';
import { RightOutlined } from '@ant-design/icons';
import { commandManager } from '@/core/command';
import {
  contextMenuRegistry,
  type ContextMenuContext,
  type ContextMenuItem,
} from '@/core/contextMenu';
import { useEditorStore } from '@/store';
import type { Widget } from '@/types/widget';
import styles from './style.module.scss';

export interface CanvasContextMenuState {
  left: number;
  top: number;
  canvasPoint: { x: number; y: number };
  targetId?: string;
}

interface CanvasContextMenuProps {
  state: CanvasContextMenuState | null;
  onClose: () => void;
}

interface ContextMenuListProps {
  ctx: ContextMenuContext;
  items: ContextMenuItem[];
  onClose: () => void;
}

function getLabel(item: ContextMenuItem, ctx: ContextMenuContext): string {
  return typeof item.label === 'function' ? item.label(ctx) : item.label;
}

function isDisabled(item: ContextMenuItem, ctx: ContextMenuContext): boolean {
  return (
    item.disabled?.(ctx) ?? (item.commandId ? !commandManager.canExecute(item.commandId) : false)
  );
}

function ContextMenuList({ ctx, items, onClose }: ContextMenuListProps) {
  return (
    <>
      {items.map((item, index) => {
        const prev = items[index - 1];
        const showDivider = index > 0 && prev?.group !== item.group;
        const label = getLabel(item, ctx);
        const disabled = isDisabled(item, ctx);
        const hasChildren = !!item.children?.length;
        const handleClick = () => {
          if (disabled || hasChildren) return;
          if (item.commandId) {
            commandManager.execute(item.commandId);
          } else {
            item.onClick?.(ctx);
          }
          onClose();
        };

        return (
          <div className={styles.itemWrap} key={item.key}>
            {showDivider ? <div className={styles.divider} /> : null}
            <button type="button" className={styles.item} disabled={disabled} onClick={handleClick}>
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{label}</span>
              <span className={styles.meta}>
                {item.shortcut ? <span>{item.shortcut}</span> : null}
                {hasChildren ? <RightOutlined /> : null}
              </span>
            </button>
            {hasChildren ? (
              <div className={styles.submenu}>
                <ContextMenuList ctx={ctx} items={item.children!} onClose={onClose} />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

export const CanvasContextMenu = ({ state, onClose }: CanvasContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const activePageId = useEditorStore((s) => s.activePageId);
  const page = useEditorStore((s) => s.pages[activePageId]);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const focusedChildId = useEditorStore((s) => s.focusedChildId);
  const widgetsState = useEditorStore((s) => s.widgets);

  const ctx = useMemo<ContextMenuContext | null>(() => {
    if (!state || !page) return null;
    const widgets = selectedIds
      .map((id) => widgetsState[id])
      .filter((widget): widget is Widget => !!widget);
    const primaryWidget = widgets[0];
    const targetWidget =
      (state.targetId ? widgetsState[state.targetId] : undefined) ??
      (focusedChildId ? widgetsState[focusedChildId] : undefined) ??
      primaryWidget;

    return {
      page,
      canvasPoint: state.canvasPoint,
      selectedIds,
      widgets,
      primaryWidget,
      targetWidget,
      selectionType:
        selectedIds.length === 0 ? 'empty' : selectedIds.length === 1 ? 'single' : 'multi',
      widgetType: targetWidget?.type ?? primaryWidget?.type,
    };
  }, [focusedChildId, page, selectedIds, state, widgetsState]);

  const items = useMemo(() => (ctx ? contextMenuRegistry.resolve(ctx) : []), [ctx]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!state) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
    };
  }, [handleKeyDown, onClose, state]);

  if (!state || !ctx || items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: state.left, top: state.top }}
      role="menu"
      tabIndex={-1}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ContextMenuList ctx={ctx} items={items} onClose={onClose} />
    </div>
  );
};
