/**
 * 画布元素（Widget）数据模型
 * 字段命名贴近 Fabric.js v7 对象属性，便于后续直接序列化为 fabric.Object
 */

/** 所有可创建的 Widget 类型 */
export type WidgetType =
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'polygon' // 基础图形
  | 'text'
  | 'i-text' // 文本
  | 'image'
  | 'svg' // 媒体
  | 'line'
  | 'arrow'
  | 'path' // 线条
  | 'group'; // 编组虚拟节点

/** 几何与通用变换属性 */
export interface BaseTransform {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 旋转角度（度） */
  angle: number;
  scaleX: number;
  scaleY: number;
  skewX?: number;
  skewY?: number;
  originX?: 'left' | 'center' | 'right';
  originY?: 'top' | 'center' | 'bottom';
}

/** 通用外观属性 */
export interface BaseAppearance {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** 0~1 */
  opacity?: number;
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
}

/** 文本特有属性 */
export interface TextProps {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: number | 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textAlign?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  underline?: boolean;
}

/** 图片 / SVG 特有属性 */
export interface ImageProps {
  src: string;
}

/** 路径 / 线条特有属性 */
export interface PathProps {
  /** 折线 / 多边形点集，格式 [x1, y1, x2, y2, ...] */
  points?: number[];
  /** SVG path d 属性 */
  path?: string;
}

/** Widget 基类 */
export interface BaseWidget extends BaseTransform, BaseAppearance {
  /** uuid 生成的唯一 id */
  id: string;
  type: WidgetType;
  /** 图层名（图层面板展示） */
  name: string;
  /** 所属页面 id */
  pageId: string;
  /** null = 根节点；其他 = 所属 group 的 id */
  parentId: string | null;
  locked?: boolean;
  visible?: boolean;
}

/** 判别联合：根据 type 区分具体形态 */
export type Widget =
  | (BaseWidget & { type: 'rect' | 'circle' | 'triangle' | 'polygon' })
  | (BaseWidget & { type: 'text' | 'i-text' } & TextProps)
  | (BaseWidget & { type: 'image' | 'svg' } & ImageProps)
  | (BaseWidget & { type: 'line' | 'arrow' | 'path' } & PathProps)
  | (BaseWidget & { type: 'group'; childrenIds: string[] });
