面试里可以这样讲：

```md
在这个编辑器里，我没有把 Fabric 对象直接当成业务数据源，而是把仓库里的 widget 数据作为唯一可信的数据源。

store 里保存的是可序列化的课件数据，比如页面、图层顺序、元素位置、尺寸、样式、文本内容等。Fabric 负责把这些数据渲染成可交互的画布对象。

所以整体关系是：store 是数据模型，Fabric 是视图层和交互层。
```

数据流可以这样说：

```txt
store.widgets / store.rootIds
  -> widgetToFabric
  -> fabric.Object
  -> 用户拖拽 / 缩放 / 旋转
  -> object:modified
  -> updateWidget
  -> store 更新
  -> diff 同步回 Fabric
```

更完整一点：

```md
当 store 中的 widgets 或 rootIds 变化时，Canvas 组件会做一次 diff：删除已经不存在的 Fabric 对象，创建新增对象，对已有对象应用 patch，并根据 rootIds 调整 z-index。

Fabric 对象上会挂一个 data.id，用来和 store 里的 widgetId 对应。这样用户在画布上选中、拖拽、缩放、旋转某个对象时，可以通过 data.id 找回对应的 widget，再把变化写回 store。

反过来，右侧属性面板或图层面板修改 store 里的 widget，比如修改 fill、visible、locked、name、层级顺序，Canvas 会监听 store 变化并同步到 Fabric。
```

面试重点可以这样总结：

```md
我把 Fabric 定位成渲染和交互引擎，而不是数据源。业务数据始终落在 Zustand store 中，这样更适合撤销重做、保存课件、导入导出、多页面、多图层和协同扩展。Fabric 对象只是 store 数据在画布上的运行时投影。
```

如果面试官问“为什么不直接操作 Fabric 对象”，你可以说：

```md
直接操作 Fabric 对象短期简单，但 Fabric 对象本身不适合作为课件数据模型。它包含很多运行时状态，也不方便做业务层的历史记录、序列化、版本迁移和跨模块共享。

所以我会把 Fabric 的变化回写到 store，再由 store 驱动画布同步，保证数据流可控。
```

你截图里关键指标：

Frame Rate: 34.8 fps：低于理想 60fps，交互已经有明显卡顿风险
INP: 632 ms：这个很差，说明点击/拖拽/选中后的响应延迟偏高
LCP: 41.02 s：这个对编辑器场景参考价值没 INP 大，但也说明首屏渲染压力很重
GPU memory: 536.9 MB max：也偏高，说明 500 个 Fabric 对象加上页面 UI 已经比较吃资源
从截图看，瓶颈不只在 Fabric 画布，还包括：

左侧图层/组件区域渲染
500 个图层如果都进左侧图层列表，DOM 压力会明显上来。后面要做虚拟列表。

Canvas 首次创建 500 个 Fabric 对象
首次 widgetToFabric + canvas.add + moveObjectTo + render 会比较重。

选中/拖动时 Fabric 重绘
500 个对象都在一个 canvas 上，Fabric 的命中检测、控制点、重绘会影响帧率。

右侧属性面板联动
选中对象后 store 更新、Canvas selection 同步、右侧面板刷新都会参与 INP。
