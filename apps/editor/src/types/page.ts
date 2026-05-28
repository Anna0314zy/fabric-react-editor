import type { Widget } from './widget';

/** 页面元信息（仅描述画布本身，不持有 widgets） */
export interface PageData {
  id: string;
  name: string;
  /** 画布宽度（px） */
  width: number;
  /** 画布高度（px） */
  height: number;
  /** 画布背景色 */
  background: string;
  /** 画布背景图（可选） */
  backgroundImage?: string;
  /** 页面缩略图（base64 或图片 URL，用于底部页面切换 / 页面管理） */
  thumbnail?: string;
}

/** 编辑器全量数据（可作为导入 / 导出 JSON 的契约） */
export interface EditorData {
  version: string;
  /** 页面字典：pageId -> 页面元信息 */
  pages: Record<string, PageData>;
  activePageId: string;
  /** 所有页面的 widget 扁平池；widget 内 pageId 字段指明归属 */
  widgets: Record<string, Widget>;
  /** pageId -> 根层级 widget id 列表（不在任何 group 内），决定渲染顺序 */
  rootIds: Record<string, string[]>;
  /** groupId -> 子 widget id 列表 */
  childIds: Record<string, string[]>;
}
