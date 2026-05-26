import { Button, Tabs } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import styles from './style.module.scss';

/** 多页管理器 - 底部页面切换标签 */
const PageManager = () => {
  // TODO: 从 store 获取页面列表
  const pages = [{ id: '1', name: '页面 1' }];
  const activePageId = '1';

  const tabItems = pages.map((page) => ({
    key: page.id,
    label: page.name,
  }));

  const handleAddPage = () => {
    // TODO: 添加新页面
  };

  const handleChangePage = (_key: string) => {
    // TODO: 切换页面
  };

  return (
    <div className={styles.wrapper}>
      <Tabs
        items={tabItems}
        activeKey={activePageId}
        onChange={handleChangePage}
        type="editable-card"
        size="small"
        onEdit={(_targetKey, action) => {
          if (action === 'add') handleAddPage();
          // TODO: handle remove
        }}
        tabBarExtraContent={
          <Button type="text" icon={<PlusOutlined />} size="small" onClick={handleAddPage}>
            新增页面
          </Button>
        }
      />
    </div>
  );
};

export default PageManager;
