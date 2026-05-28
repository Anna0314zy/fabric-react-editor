import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initEditor } from '@/core/init';
import '@/styles/global.scss';

// 编辑器启动：注册命令 + 快捷键（先于首屏渲染）
initEditor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
