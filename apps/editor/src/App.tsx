import Header from '@/components/Header';
import LeftPanel from '@/components/LeftPanel';
import Canvas from '@/components/Canvas';
import RightPanel from '@/components/RightPanel';
import ContextMenuHost from '@/components/ContextMenuHost';
// import PageManager from '@/components/PageManager';
import styles from './App.module.scss';

function App() {
  // 全局快捷键不再在此处理：统一通过 ShortcutManager → CommandManager → Editor API 分发
  // 入口在 main.tsx 调用 initEditor() 一次性注册
  return (
    <>
      <div className={styles.editorLayout}>
        {/* 顶部工具栏 */}
        <Header />

        {/* 主体区域 */}
        <div className={styles.editorBody}>
          {/* 左侧组件面板 */}
          <LeftPanel />

          {/* 中间画布 + 底部页面管理 */}
          <div className={styles.editorCenter}>
            <Canvas />
            {/* <PageManager /> */}
          </div>

          {/* 右侧属性配置面板 */}
          <RightPanel />
        </div>
      </div>
      <ContextMenuHost />
    </>
  );
}

export default App;
