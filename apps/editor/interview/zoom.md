面试里可以这样说，重点讲清楚 **坐标系、显示缩放、窗口适配** 三件事。

```md
我在画布缩放这里做了一个分层设计：课件页面尺寸和编辑器视图缩放是分开的。

页面本身有一个固定的逻辑尺寸，比如 16:9 是 1280x720，4:3 是 1024x768。所有 widget 的 left、top、width、height 都基于这个逻辑尺寸存储。

Fabric canvas 初始化时也使用这个逻辑尺寸，所以 Fabric 内部坐标系始终稳定。放大缩小不会修改 widget 坐标，也不会修改 page 的真实内容数据。

真正的缩放是在显示层完成的。我在 canvas 外面包了两层：

container 是中间滚动区域；
viewport 是缩放后的占位盒子；
stage 是真实逻辑尺寸的画布，通过 CSS transform: scale(zoom) 做视觉缩放。

viewport 的宽高等于 pageWidth _ zoom 和 pageHeight _ zoom，这样浏览器滚动区域能感知缩放后的尺寸。stage 仍然保持 pageWidth 和 pageHeight，只是通过 transform 放大或缩小。

这样做的好处是，编辑器缩放只是视图状态，不会污染课件数据。用户放大到 200% 编辑，保存的数据仍然是 1280x720 坐标系下的 widget 数据。播放器渲染时也可以忽略编辑器 zoom，根据播放设备重新计算自己的 scale。
```

可以补充 fit 逻辑：

```md
适应窗口是通过 ResizeObserver 做的。Canvas 容器尺寸变化时，我用容器可用宽高除以页面逻辑宽高，取较小值作为 zoom：

zoom = Math.min(containerWidth / pageWidth, containerHeight / pageHeight)

这样可以保证页面完整显示在中间区域里。用户手动点击放大缩小时，会切到 manual 模式；点击适应窗口时再切回 fit 模式。
```

一句完整话术：

```md
这个方案的核心是把“课件坐标系”和“编辑器视口缩放”解耦。页面尺寸决定数据坐标，zoom 只决定显示比例。Canvas 内部仍然按真实页面尺寸渲染，外层通过 viewport 占位和 stage transform 实现缩放。这样既能支持 4:3 / 16:9，又能支持窗口自适应，同时不会因为编辑器放大缩小影响保存数据和播放器渲染。
```

如果面试官问为什么不用直接改 Fabric zoom，可以说：

```md
Fabric 也有 viewportTransform / setZoom，但我的这个阶段更关注编辑器页面本身的缩放展示，不想让 zoom 影响对象坐标和业务数据。CSS transform 的方案实现简单，数据层更稳定，也方便播放器复用同一套 page 尺寸逻辑。后续如果要支持无限画布、拖拽平移、鼠标位置精确缩放，可以再引入 Fabric viewportTransform。
```
