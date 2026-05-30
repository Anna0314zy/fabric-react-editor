import * as fabric from 'fabric';
import type { Widget } from '@/types/widget';
import { widgetToFabric } from './widgetToFabric';

/**
 * 根据 widget 树创建 Fabric 对象。
 *
 * @param widget widget：当前要渲染的 widget，group 会递归渲染 childIds。
 * @param widgets widgets：扁平 widget 池。
 * @param childIds childIds：groupId -> 子节点 id 列表。
 * @returns 可加入 Canvas 的 fabric.Object，无法渲染时返回 null。
 */
export function widgetTreeToFabric(
  widget: Widget,
  widgets: Record<string, Widget>,
  childIds: Record<string, string[]>,
): fabric.Object | null {
  if (widget.type !== 'group') {
    return widgetToFabric(widget);
  }

  const children = (childIds[widget.id] ?? widget.childrenIds)
    .map((id) => {
      const child = widgets[id];
      return child ? widgetTreeToFabric(child, widgets, childIds) : null;
    })
    .filter((obj): obj is fabric.Object => !!obj);

  if (children.length === 0) return null;

  children.forEach((child) => {
    child.set({
      left: (child.left ?? 0) - widget.left,
      top: (child.top ?? 0) - widget.top,
      selectable: false,
      evented: true,
    });
    child.setCoords();
  });

  const group = new fabric.Group(children, {
    left: widget.left,
    top: widget.top,
    angle: widget.angle,
    scaleX: widget.scaleX,
    scaleY: widget.scaleY,
    skewX: widget.skewX ?? 0,
    skewY: widget.skewY ?? 0,
    originX: widget.originX ?? 'left',
    originY: widget.originY ?? 'top',
    opacity: widget.opacity ?? 1,
    visible: widget.visible ?? true,
    selectable: !widget.locked,
    evented: !widget.locked,
    subTargetCheck: true,
  });
  group.set({ data: { id: widget.id } });
  return group;
}
