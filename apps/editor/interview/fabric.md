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

这个编辑器里我把性能优化重点放在“减少无效更新”和“拆分更新路径”上。

一开始的问题是：页面里有几百个 Fabric 对象时，任意一个元素更新都会触发一整套全量同步，包括遍历所有对象、检查层级、更新 Fabric、React 面板重渲染等。这样对象数量上来后，很容易出现长任务和掉帧。

我做了几类优化：

结构更新和属性更新拆开
原来 widgets 或 rootIds 一变，Canvas 就统一 diff。现在拆成两条路径：

rootIds 变化 -> 处理新增、删除、层级顺序
widget 属性变化 -> 只 patch 对应 Fabric 对象
这样改颜色、位置、大小时，不会再触发层级检查。

批量 Canvas 操作只渲染一次
新增、删除、层级移动时，会涉及大量 canvas.add/remove/moveObjectTo。

我用：

canvas.renderOnAddRemove = false
临时关闭 Fabric 自动渲染，批量操作结束后只调用一次：

canvas.requestRenderAll()
避免 500 个对象初始化时触发多次重绘。

用增量 patch 代替全量扫描
之前改一个对象，也要遍历当前页所有对象找变化。

现在 store 里维护：

widgetPatches
widgetPatchVersion
每次 \_updateWidget 记录本次变化的 widgetId 和 patch。Canvas 只订阅 widgetPatchVersion，再消费 widgetPatches。

这样属性同步从：

O(n) n = 当前页对象数
变成接近：

O(k) k = 本次真正变化的对象数
比如 500 个对象里只改 1 个，就只处理 1 个 patch。

图层面板虚拟列表
500 个对象对应 500 个图层，如果一次性渲染所有 DOM，会拖慢 React。

所以我把图层面板改成虚拟列表，只渲染可视区域附近的行。

拆分图层行订阅
原来 LeftPanel 订阅整个 widgets，任意 widget 更新都会让整个左侧重新计算：

rootIds.map(id => widgets[id])
后来拆成：

LeftPanel -> 只负责 Tab
LayerPanel -> 只订阅 rootIds
LayerRow -> 只订阅自己的 widget
这样单个图层更新时，只影响对应行，不影响整个面板。

右侧属性面板做本地缓冲
之前右侧表单每次 onChange 都会：

updateWidget -> history -> store -> canvas patch -> render
拖动 slider 或输入数字时会非常高频。

现在改成：

输入中 -> 本地 draft state
提交时 -> updateWidget
比如 InputNumber 在 blur / Enter 时提交，Slider 在 onChangeComplete 时提交，ColorPicker 在完成时提交。这样避免每一帧都触发全局状态和 Canvas 重绘。

一句话总结

我的优化思路不是简单地缓存，而是先区分更新类型：结构变化、属性变化、UI 表单输入、图层列表渲染分别走不同路径。这样把大对象场景下的无效计算降下来，避免一个小改动触发整页 Canvas 和整棵 React UI 更新。
还可以继续做什么优化

拖拽中只让 Fabric 自己动，结束后再写 store
现在如果未来做 object:moving 实时回写 store，一定要节流。更推荐：

moving 中 Fabric 自己渲染
modified 时一次性写 store
requestAnimationFrame 合并更新
对于连续 patch，可以放进一帧里统一处理：

多次 updateWidget -> 合并到下一帧 apply
生产环境性能测试
Dev 模式 React、antd、source map、DevTools 都会放大耗时。最终要用：

pnpm build
pnpm preview
测生产包。

减少复杂 Fabric 对象
文本、阴影、滤镜、复杂路径比矩形重。可以：

拖拽时临时关闭 shadow/filter
低缩放时隐藏细节
复杂对象开启 objectCaching
按视口裁剪渲染
如果课件画布很大，可以只激活可视区域附近的对象，远离视口的对象降低交互成本。

分层 Canvas
把背景、静态元素、当前交互元素拆到不同 canvas：

static canvas
interactive fabric canvas
overlay canvas
静态层不参与每次交互重绘。

历史命令合并
拖动、缩放、输入这种连续操作，需要合并成一条 history command，避免历史栈过大，也减少中间状态处理。

图层面板进一步轻量化
减少 antd Button/Tooltip 数量，hover 时再渲染操作区，或使用原生 button + icon。

Store selector 更细粒度
对属性面板、图层行、Header 等继续拆 selector，避免无关 state 变化引发重渲染。

性能监控常态化
保留 FPS、long task、render count 监控，明确每次优化前后的指标变化。不要只靠感觉判断。
