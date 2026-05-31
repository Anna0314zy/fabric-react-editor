import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as fabric from 'fabric';
import { Button, Tooltip } from 'antd';
import { commandManager } from '@/core/command';
import { canvasEngine } from '@/core/engine';
import { floatingMenuRegistry, type FloatingMenuContext } from '@/core/floatingMenu';
import { useEditorStore } from '@/store';
import styles from './style.module.scss';

interface DOMRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
}

interface MenuSize {
  width: number;
  height: number;
}

interface MenuPosition {
  left: number;
  top: number;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

interface CanvasFloatingMenuProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  getCanvas: () => fabric.Canvas | null;
  hidden?: boolean;
}

const GAP = 28;
function toRect(left: number, top: number, width: number, height: number): DOMRectLike {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

/**
 * 根据选区屏幕矩形，计算悬浮菜单上方居中位置。
 *
 * @param anchorRect anchorRect：选区经过 CSS 缩放后的屏幕坐标矩形。
 * @param menuSize menuSize：菜单 DOM 实际宽高。
 * @returns 菜单屏幕坐标；当前版本固定显示在选区上方中间。
 */
function computeMenuPosition(anchorRect: DOMRectLike, menuSize: MenuSize): MenuPosition {
  return {
    placement: 'top',
    left: anchorRect.left + anchorRect.width / 2 - menuSize.width / 2,
    top: anchorRect.top - menuSize.height - GAP,
  };
}

function getSelectionRect(canvas: fabric.Canvas): DOMRectLike | null {
  const ids = useEditorStore.getState().selectedIds;
  if (ids.length === 0) return null;

  const boxes = ids
    .map((id) => canvasEngine.getBoundingBox(id))
    .filter((box): box is fabric.TBBox => !!box);
  if (boxes.length === 0) return null;

  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  const canvasRect = canvas.getElement().getBoundingClientRect();
  const scaleX = canvasRect.width / canvas.getWidth();
  const scaleY = canvasRect.height / canvas.getHeight();

  return toRect(
    canvasRect.left + left * scaleX,
    canvasRect.top + top * scaleY,
    (right - left) * scaleX,
    (bottom - top) * scaleY,
  );
}

export const CanvasFloatingMenu = ({
  containerRef,
  getCanvas,
  hidden,
}: CanvasFloatingMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const selectedIds = useEditorStore((s) => s.selectedIds);
  const widgetPatchVersion = useEditorStore((s) => s.widgetPatchVersion);
  const zoom = useEditorStore((s) => s.zoom);
  const [menuSize, setMenuSize] = useState<MenuSize>({ width: 0, height: 0 });
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const widgetsState = useEditorStore.getState().widgets;
  const widgets = selectedIds
    .map((id) => widgetsState[id])
    .filter((widget): widget is NonNullable<typeof widget> => !!widget);
  const primaryWidget = widgets[0];
  const ctx: FloatingMenuContext = {
    selectedIds,
    widgets,
    primaryWidget,
    selectionType:
      selectedIds.length === 0 ? 'empty' : selectedIds.length === 1 ? 'single' : 'multi',
    widgetType: primaryWidget?.type,
  };
  const items = floatingMenuRegistry.resolve(ctx);
  const itemSignature = items.map((item) => item.key).join('|');

  const updatePosition = useCallback(() => {
    const canvas = getCanvas();
    const container = containerRef.current;
    if (!canvas || !container || hidden || ctx.selectionType === 'empty' || menuSize.width === 0) {
      setPosition(null);
      return;
    }

    const anchorRect = getSelectionRect(canvas);
    if (!anchorRect) {
      setPosition(null);
      return;
    }

    const screenPosition = computeMenuPosition(anchorRect, menuSize);
    const containerRect = container.getBoundingClientRect();
    setPosition({
      ...screenPosition,
      left: screenPosition.left - containerRect.left + container.scrollLeft,
      top: screenPosition.top - containerRect.top + container.scrollTop,
    });
  }, [containerRef, ctx.selectionType, getCanvas, hidden, menuSize]);

  const scheduleUpdatePosition = useCallback(() => {
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      updatePosition();
    });
  }, [updatePosition]);

  useLayoutEffect(() => {
    const node = menuRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setMenuSize((prev) => {
      if (
        Math.round(prev.width) === Math.round(rect.width) &&
        Math.round(prev.height) === Math.round(rect.height)
      ) {
        return prev;
      }
      return { width: rect.width, height: rect.height };
    });
  }, [itemSignature]);

  useEffect(() => {
    scheduleUpdatePosition();
  }, [scheduleUpdatePosition, selectedIds, widgetPatchVersion, zoom, items.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    window.addEventListener('resize', scheduleUpdatePosition);
    container.addEventListener('scroll', scheduleUpdatePosition, { passive: true });
    return () => {
      window.removeEventListener('resize', scheduleUpdatePosition);
      container.removeEventListener('scroll', scheduleUpdatePosition);
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [containerRef, scheduleUpdatePosition]);

  if (ctx.selectionType === 'empty' || items.length === 0 || hidden) return null;

  return (
    <div
      ref={menuRef}
      className={styles.menu}
      data-placement={position?.placement ?? 'top'}
      style={{
        left: position?.left ?? -9999,
        top: position?.top ?? -9999,
        visibility: position ? 'visible' : 'hidden',
      }}
    >
      {items.map((item, index) => {
        const prev = items[index - 1];
        const showDivider = index > 0 && prev?.group !== item.group;
        const disabled =
          item.disabled?.(ctx) ??
          (item.commandId ? !commandManager.canExecute(item.commandId) : false);
        const label = typeof item.label === 'function' ? item.label(ctx) : item.label;
        const content = item.render ? item.render(ctx) : item.icon;
        const handleClick = () => {
          if (disabled) return;
          if (item.commandId) {
            commandManager.execute(item.commandId);
            return;
          }
          item.onClick?.(ctx);
        };

        if (!item.commandId && !item.onClick && item.render) {
          return (
            <div className={styles.itemGroup} key={item.key}>
              {showDivider ? <span className={styles.divider} /> : null}
              {content}
            </div>
          );
        }

        return (
          <div className={styles.itemGroup} key={item.key}>
            {showDivider ? <span className={styles.divider} /> : null}
            <Tooltip title={label}>
              <Button
                type="text"
                size="small"
                className={styles.button}
                icon={item.render ? undefined : item.icon}
                aria-label={label}
                disabled={disabled}
                onClick={handleClick}
              >
                {item.render ? content : null}
              </Button>
            </Tooltip>
          </div>
        );
      })}
    </div>
  );
};
