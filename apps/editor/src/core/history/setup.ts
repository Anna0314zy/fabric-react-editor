import { canvasEngine } from '@/core/engine';
import { captureEditorDocumentSnapshot, restoreEditorDocumentSnapshot } from '@/store';
import { history } from './index';

let configured = false;

export function configureHistorySnapshots(): void {
  if (configured) return;

  history.configureSnapshotAdapter({
    capture: captureEditorDocumentSnapshot,
    restore: restoreEditorDocumentSnapshot,
    beginReplay: () => canvasEngine.beginRenderBatch(),
    endReplay: () => canvasEngine.endRenderBatch(),
  });
  configured = true;
}
