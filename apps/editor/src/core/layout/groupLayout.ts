import type { GroupLayout, Widget } from '@/types/widget';

export const DEFAULT_GROUP_LAYOUT: GroupLayout = {
  mode: 'none',
  columns: 3,
  gapX: 12,
  gapY: 12,
  paddingX: 16,
  paddingY: 16,
  stretch: false,
};

const clampPositive = (value: number, fallback: number): number =>
  Number.isFinite(value) && value > 0 ? value : fallback;

const clampNonNegative = (value: number): number =>
  Number.isFinite(value) && value > 0 ? value : 0;

export function normalizeGroupLayout(layout?: Partial<GroupLayout>): GroupLayout {
  return {
    ...DEFAULT_GROUP_LAYOUT,
    ...layout,
    columns: Math.max(1, Math.round(clampPositive(layout?.columns ?? 3, 3))),
    gapX: clampNonNegative(layout?.gapX ?? DEFAULT_GROUP_LAYOUT.gapX),
    gapY: clampNonNegative(layout?.gapY ?? DEFAULT_GROUP_LAYOUT.gapY),
    paddingX: clampNonNegative(layout?.paddingX ?? DEFAULT_GROUP_LAYOUT.paddingX),
    paddingY: clampNonNegative(layout?.paddingY ?? DEFAULT_GROUP_LAYOUT.paddingY),
    stretch: layout?.stretch ?? DEFAULT_GROUP_LAYOUT.stretch,
  };
}

export function getGroupLayout(widget: Extract<Widget, { type: 'group' }>): GroupLayout {
  return normalizeGroupLayout(widget.layout);
}

export function computeGroupLayoutPatches(
  group: Extract<Widget, { type: 'group' }>,
  children: Widget[],
  layout: GroupLayout,
): Record<string, Partial<Widget>> {
  if (layout.mode !== 'grid' || children.length === 0) return {};

  const columns = Math.max(1, Math.min(layout.columns, children.length));
  const rows = Math.ceil(children.length / columns);
  const innerWidth = Math.max(1, group.width - layout.paddingX * 2 - layout.gapX * (columns - 1));
  const innerHeight = Math.max(1, group.height - layout.paddingY * 2 - layout.gapY * (rows - 1));
  const cellWidth = innerWidth / columns;
  const cellHeight = innerHeight / rows;

  return children.reduce<Record<string, Partial<Widget>>>((patches, child, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const patch: Partial<Widget> = {
      left: group.left + layout.paddingX + col * (cellWidth + layout.gapX),
      top: group.top + layout.paddingY + row * (cellHeight + layout.gapY),
    };

    if (layout.stretch) {
      patch.width = cellWidth;
      patch.height = cellHeight;
      patch.scaleX = 1;
      patch.scaleY = 1;
    }

    patches[child.id] = patch;
    return patches;
  }, {});
}
