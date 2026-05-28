面试里可以这样总结，重点说“为什么这么设计”，不要只说用了 `hotkeys-js`。

## 我在项目里把快捷键系统设计成了三层：

第一层是 ShortcutManager，负责键盘事件注册、平台键归一化、scope 管理、冲突检测和输入框保护。

第二层是 CommandManager，负责维护可执行命令，比如 editor.undo、editor.redo、layer.moveUp。快捷键不直接操作业务状态，只触发 commandId。

第三层才是具体业务逻辑，比如 history.undo、删除图层、修改画布元素等。

这样设计的好处是快捷键、按钮、菜单、右键菜单都可以复用同一个 command，避免各处重复写业务逻辑。

## 可以继续补几句关键设计点：

在快捷键注册上，我支持了 mod 语义，mod 会展开成 command 和 ctrl，用来兼容 macOS 和 Windows / Linux。

同时我做了 normalizeKey，把 shift+ctrl+z 和 ctrl+shift+z 标准化成同一种格式，并通过 bindingIndex 做冲突检测，避免同一作用域下多个命令绑定到同一个快捷键。

作用域上，我基于 scope 做上下文隔离，比如 global、modal、textEditing。打开弹窗时可以 enterScope('modal')，关闭时恢复之前的 scope，避免弹窗里的快捷键和全局快捷键冲突。

另外默认会屏蔽 input、textarea、select、contentEditable 里的快捷键，避免用户输入文字时触发编辑器命令。

## 如果面试官问“为什么不直接在组件里监听 keydown”，你可以说：

因为编辑器会有很多入口触发同一个动作，比如撤销可以来自快捷键、顶部按钮、菜单项。如果每个组件都自己监听和操作状态，后面会很难维护，也容易出现逻辑不一致。

所以我把动作抽象成 command，快捷键只是 command 的一种触发方式。

## 一句比较完整的面试表达：

这个快捷键系统的核心目标是可维护和可扩展。我没有把快捷键逻辑散落在 React 组件里，而是通过 ShortcutManager 统一注册和分发，再通过 CommandManager 执行业务命令。ShortcutManager 处理平台差异、快捷键标准化、冲突检测、scope 隔离、输入框保护和 preventDefault；CommandManager 处理命令注册、执行和 canExecute。这样后续做快捷键面板、用户自定义快捷键、菜单系统、右键菜单和插件快捷键时，都能复用同一套 commandId 和注册模型。
