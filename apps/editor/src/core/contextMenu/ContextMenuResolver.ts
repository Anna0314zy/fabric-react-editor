import { commandManager } from '@/core/command';
import { contextMenuRegistry } from './ContextMenuRegistry';
import type { ContextMenuContext, ContextMenuDefinition, ContextMenuViewModel } from './types';

function resolveDefinition(
  definition: ContextMenuDefinition,
  ctx: ContextMenuContext,
): ContextMenuViewModel | null {
  if (!(definition.when?.(ctx) ?? true)) return null;

  const children = definition.children
    ?.map((child) => resolveDefinition(child, ctx))
    .filter((child): child is ContextMenuViewModel => child !== null)
    .sort((a, b) => a.order - b.order);

  if (definition.children && children?.length === 0) return null;

  const commandArgs = definition.commandArgs?.(ctx);
  const disabled = definition.commandId
    ? !commandManager.canExecute(definition.commandId, commandArgs)
    : false;

  return {
    key: definition.key,
    label: typeof definition.label === 'function' ? definition.label(ctx) : definition.label,
    icon: definition.icon,
    group: definition.group,
    order: definition.order ?? 0,
    shortcut: definition.shortcut,
    commandId: definition.commandId,
    commandArgs,
    disabled,
    children,
  };
}

class ContextMenuResolver {
  resolve(ctx: ContextMenuContext): ContextMenuViewModel[] {
    return contextMenuRegistry
      .list()
      .map((definition) => resolveDefinition(definition, ctx))
      .filter((item): item is ContextMenuViewModel => item !== null)
      .sort((a, b) => a.order - b.order);
  }
}

export const contextMenuResolver = new ContextMenuResolver();
