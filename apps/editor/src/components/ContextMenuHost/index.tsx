import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RightOutlined } from '@ant-design/icons';
import { commandManager } from '@/core/command';
import {
  contextMenuResolver,
  type ContextMenuContext,
  type ContextMenuViewModel,
} from '@/core/contextMenu';
import { useEditorStore } from '@/store';
import { contextMenu, useContextMenuStore } from '@/store/contextMenu';
import type { Widget } from '@/types/widget';
import styles from './style.module.scss';

interface ContextMenuListProps {
  items: ContextMenuViewModel[];
}

const VIEWPORT_GAP = 8;

function ContextMenuList({ items }: ContextMenuListProps) {
  return (
    <>
      {items.map((item, index) => {
        const prev = items[index - 1];
        const showDivider = index > 0 && prev?.group !== item.group;
        const hasChildren = !!item.children?.length;
        const handleClick = () => {
          if (item.disabled || hasChildren || !item.commandId) return;
          if (item.commandId) {
            commandManager.execute(item.commandId, item.commandArgs);
          }
          contextMenu.close();
        };

        return (
          <div className={styles.itemWrap} key={item.key}>
            {showDivider ? <div className={styles.divider} /> : null}
            <button
              type="button"
              className={styles.item}
              disabled={item.disabled}
              onClick={handleClick}
            >
              <span className={styles.icon}>{item.icon}</span>
              <span className={styles.label}>{item.label}</span>
              <span className={styles.meta}>
                {item.shortcut ? <span>{item.shortcut}</span> : null}
                {hasChildren ? <RightOutlined /> : null}
              </span>
            </button>
            {hasChildren ? (
              <div className={styles.submenu}>
                <ContextMenuList items={item.children!} />
              </div>
            ) : null}
          </div>
        );
      })}
    </>
  );
}

function ContextMenuHost() {
  const open = useContextMenuStore((state) => state.open);
  const menuContext = useContextMenuStore((state) => state.context);
  const activePageId = useEditorStore((state) => state.activePageId);
  const page = useEditorStore((state) => state.pages[activePageId]);
  const selectedIds = useEditorStore((state) => state.selectedIds);
  const focusedChildId = useEditorStore((state) => state.focusedChildId);
  const widgetsState = useEditorStore((state) => state.widgets);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const ctx = useMemo<ContextMenuContext | null>(() => {
    if (!open || !menuContext || !page) return null;

    const widgets = selectedIds
      .map((id) => widgetsState[id])
      .filter((widget): widget is Widget => !!widget);
    const primaryWidget = widgets[0];
    const targetWidget =
      (menuContext.targetId ? widgetsState[menuContext.targetId] : undefined) ??
      (focusedChildId ? widgetsState[focusedChildId] : undefined) ??
      primaryWidget;

    return {
      page,
      canvasPoint: menuContext.canvasPoint,
      selectedIds,
      widgets,
      primaryWidget,
      targetWidget,
      selectionType:
        selectedIds.length === 0 ? 'empty' : selectedIds.length === 1 ? 'single' : 'multi',
      widgetType: targetWidget?.type ?? primaryWidget?.type,
    };
  }, [focusedChildId, menuContext, open, page, selectedIds, widgetsState]);

  const items = useMemo(() => (ctx ? contextMenuResolver.resolve(ctx) : []), [ctx]);

  useLayoutEffect(() => {
    if (!open || !menuContext) return;

    const menu = menuRef.current;
    if (!menu) return;

    const { width, height } = menu.getBoundingClientRect();
    setPosition({
      x: Math.max(VIEWPORT_GAP, Math.min(menuContext.x, window.innerWidth - width - VIEWPORT_GAP)),
      y: Math.max(
        VIEWPORT_GAP,
        Math.min(menuContext.y, window.innerHeight - height - VIEWPORT_GAP),
      ),
    });
  }, [items, menuContext, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        contextMenu.close();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') contextMenu.close();
    };
    const handleViewportChange = () => contextMenu.close();

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleViewportChange);
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('scroll', handleViewportChange, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('scroll', handleViewportChange, true);
    };
  }, [open]);

  if (!open || !menuContext || !ctx || items.length === 0) return null;

  return createPortal(
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ left: position.x, top: position.y }}
      role="menu"
      tabIndex={-1}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <ContextMenuList items={items} />
    </div>,
    document.body,
  );
}

export default ContextMenuHost;
