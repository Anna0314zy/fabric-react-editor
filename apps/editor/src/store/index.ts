import { create } from 'zustand';

/** 页面数据结构 */
export interface PageData {
  id: string;
  name: string;
  objects: unknown[]; // fabric 对象序列化数据
}

/** 编辑器全局状态 */
interface EditorState {
  /** 页面列表 */
  pages: PageData[];
  /** 当前激活页面 ID */
  activePageId: string;
  /** 当前选中对象 */
  selectedObject: unknown | null;
  /** 缩放比例 */
  zoom: number;

  // Actions
  addPage: () => void;
  removePage: (id: string) => void;
  setActivePage: (id: string) => void;
  setSelectedObject: (obj: unknown | null) => void;
  setZoom: (zoom: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  pages: [{ id: '1', name: '页面 1', objects: [] }],
  activePageId: '1',
  selectedObject: null,
  zoom: 1,

  addPage: () =>
    set((state) => {
      const newId = String(Date.now());
      return {
        pages: [...state.pages, { id: newId, name: `页面 ${state.pages.length + 1}`, objects: [] }],
        activePageId: newId,
      };
    }),

  removePage: (id) =>
    set((state) => {
      if (state.pages.length <= 1) return state;
      const pages = state.pages.filter((p) => p.id !== id);
      const activePageId = state.activePageId === id ? (pages[0]?.id ?? '') : state.activePageId;
      return { pages, activePageId };
    }),

  setActivePage: (id) => set({ activePageId: id }),
  setSelectedObject: (obj) => set({ selectedObject: obj }),
  setZoom: (zoom) => set({ zoom }),
}));
