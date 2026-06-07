import { create } from 'zustand';

export interface ContextMenuOpenContext {
  x: number;
  y: number;
  source: 'canvas';
  canvasPoint: { x: number; y: number };
  targetId?: string;
}

interface ContextMenuState {
  open: boolean;
  context: ContextMenuOpenContext | null;
}

const initialState: ContextMenuState = {
  open: false,
  context: null,
};

export const useContextMenuStore = create<ContextMenuState>(() => initialState);

export const contextMenu = {
  open(context: ContextMenuOpenContext) {
    useContextMenuStore.setState({
      open: true,
      context,
    });
  },

  close() {
    useContextMenuStore.setState({
      open: false,
      context: null,
    });
  },
};
