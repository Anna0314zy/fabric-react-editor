import type { PageData } from '@/types/page';
import type { Widget } from '@/types/widget';

export interface EditorDocumentSnapshot {
  pages: Record<string, PageData>;
  widgets: Record<string, Widget>;
  rootIds: Record<string, string[]>;
  childIds: Record<string, string[]>;
  activePageId: string;
}

export interface HistorySnapshotAdapter {
  capture(): EditorDocumentSnapshot;
  restore(snapshot: EditorDocumentSnapshot): void;
  beginReplay?(): void;
  endReplay?(): void;
}
