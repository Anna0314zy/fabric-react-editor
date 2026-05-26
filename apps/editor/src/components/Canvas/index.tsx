import { useEffect, useRef } from 'react';
import styles from './style.module.scss';

const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // TODO: 初始化 fabric.Canvas 实例
    // const canvas = new fabric.Canvas(canvasRef.current);
  }, []);

  return (
    <div className={styles.container} ref={containerRef}>
      <canvas ref={canvasRef} />
    </div>
  );
};

export default Canvas;
