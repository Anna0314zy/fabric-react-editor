import Header from '@/components/Header';
import LeftPanel from '@/components/LeftPanel';
import Canvas from '@/components/Canvas';
import RightPanel from '@/components/RightPanel';
import PageManager from '@/components/PageManager';
import styles from './App.module.scss';

function App() {
  return (
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
          <PageManager />
        </div>

        {/* 右侧属性配置面板 */}
        <RightPanel />
      </div>
    </div>
  );
}

export default App;
