import type { Widget } from '@/types/widget';

export function getRootWidgetId(id: string, widgets: Record<string, Widget>): string | null {
  let current: Widget | undefined = widgets[id];
  if (!current) return null;

  while (current.parentId !== null) {
    const parent: Widget | undefined = widgets[current.parentId];
    if (!parent) return null;
    current = parent;
  }

  return current.id;
}
