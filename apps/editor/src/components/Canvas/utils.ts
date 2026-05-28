import type * as fabric from 'fabric';
import { logger } from '@/core/logger';

export function monitorFabricPerformance(canvas: fabric.Canvas): () => void {
  let count = 0;
  let last = performance.now();

  const handleAfterRender = () => {
    count++;
  };

  canvas.on('after:render', handleAfterRender);

  const timer = window.setInterval(() => {
    const now = performance.now();
    const fps = count;
    const msPerRender = (now - last) / (count || 1);

    logger.debug('CanvasPerformance', {
      fps,
      msPerRender,
    });

    count = 0;
    last = now;
  }, 1000);

  return () => {
    canvas.off('after:render', handleAfterRender);
    window.clearInterval(timer);
  };
}
