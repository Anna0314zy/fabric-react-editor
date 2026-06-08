# fabric-react-editor

基于 **pnpm workspaces + Turborepo** 的 monorepo 基础骨架。

## 仓库结构

```
fabric-react-editor/
├── apps/                 # 可独立运行的应用 (editor, docs, playground...)
├── packages/             # 可被复用的库 (core, ui, utils...)
├── .husky/               # Git hooks (pre-commit / commit-msg)
├── package.json          # 根工作区配置
├── pnpm-workspace.yaml   # pnpm workspace 声明
├── turbo.json            # Turborepo 任务管线
├── tsconfig.base.json    # 共享 TypeScript 基础配置
├── eslint.config.js      # ESLint v9 flat config (TS + React + Prettier)
├── .prettierrc.json      # Prettier 格式化规则
├── commitlint.config.js  # Conventional Commits 校验规则
├── .lintstagedrc.json    # 提交前增量 lint 配置
├── .editorconfig         # 编辑器统一行为
├── .npmrc                # pnpm 行为配置
└── .nvmrc                # Node 版本
```

## 环境要求

- Node.js `>= 18`（建议使用 `nvm use` 自动切换）
- pnpm `>= 9`（已通过 `packageManager` 字段锁定，可执行 `corepack enable` 启用）

## 常用命令

在仓库根目录执行：

```bash
pnpm install        # 安装所有工作区依赖
pnpm dev            # 并行运行所有子包的 dev 任务
pnpm build          # 按依赖拓扑构建所有子包（带缓存）
pnpm lint           # 全局 lint（通过 turbo 调度子包）
pnpm lint:root      # 直接对仓库根 ESLint 检查
pnpm lint:fix       # 自动修复 lint 问题
pnpm format         # 用 Prettier 格式化全部文件
pnpm format:check   # 校验 Prettier 格式化（不写文件）
pnpm typecheck      # 全局类型检查
pnpm test           # 运行所有测试
pnpm clean          # 清理产物
```

仅对单个子包执行：

```bash
pnpm --filter <pkg-name> build
pnpm --filter <pkg-name> dev
```

## GitHub 自动发布

仓库已内置 GitHub Actions：

- `.github/workflows/ci.yml`：在 PR 以及推送到 `main` / `master` 时执行格式校验、lint、类型检查和构建。
- `.github/workflows/deploy-pages.yml`：在推送到 `main` / `master` 或手动触发时，构建 `@fabric-react-editor/editor` 并发布 `apps/editor/dist` 到 GitHub Pages。

首次使用前，在 GitHub 仓库页面进入 `Settings -> Pages`，将 `Build and deployment` 的 `Source` 设置为 `GitHub Actions`。发布后的访问地址通常是：

```text
https://<owner>.github.io/<repo>/
```

部署 workflow 会自动把 Vite 的 `base` 设置为 `/<repo>/`，本地开发仍保持 `/`。

## 新增子包

1. 在 `apps/` 或 `packages/` 下新建目录，例如 `packages/core`。
2. 在该目录添加 `package.json`：

   ```json
   {
     "name": "@fabric-react-editor/core",
     "version": "0.0.0",
     "private": true,
     "main": "./src/index.ts",
     "types": "./src/index.ts",
     "scripts": {
       "build": "tsc -p tsconfig.json",
       "dev": "tsc -p tsconfig.json --watch",
       "typecheck": "tsc --noEmit"
     }
   }
   ```

3. 添加 `tsconfig.json` 并继承根配置：

   ```json
   {
     "extends": "../../tsconfig.base.json",
     "compilerOptions": { "outDir": "dist", "rootDir": "src" },
     "include": ["src"]
   }
   ```

4. 包间互相引用使用 workspace 协议：

   ```json
   {
     "dependencies": {
       "@fabric-react-editor/core": "workspace:*"
     }
   }
   ```

5. 根目录执行 `pnpm install` 完成软链。

## 代码规范与提交规范

- **Lint**：ESLint v9 flat config，覆盖 TS / React / React Hooks，Prettier 关闭与之冲突的格式规则。
- **格式化**：Prettier v3，配置见 `.prettierrc.json`，忽略规则见 `.prettierignore`。
- **提交规范**：遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-hans/)，由 commitlint 校验。
  允许的 type：`feat` / `fix` / `docs` / `style` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `revert`。
- **Git Hooks**（由 husky 安装到 `.husky/`，`pnpm install` 时自动启用）：
  - `pre-commit`：执行 lint-staged，对暂存文件跑 ESLint --fix + Prettier --write
  - `commit-msg`：执行 commitlint 校验提交信息

### 验证步骤

```bash
pnpm install                     # 装依赖并触发 husky 启用
pnpm lint:root                   # 应能正常运行（仓库目前为空，无报错）
pnpm format:check                # 验证 Prettier 配置生效
git commit -m "chore: test"      # 应通过 commitlint 校验
git commit -m "随便写"           # 应被 commitlint 拒绝
```

## 快捷键系统设计

编辑器快捷键不建议散落在组件里直接监听 `keydown`。当前项目采用 `ShortcutManager -> CommandManager -> 具体业务命令` 的分层方式：快捷键层只负责把按键映射到 `commandId`，真正的撤销、重做、删除、复制、对齐等能力统一注册为命令。

### 设计时考虑的问题

- **命令与按键解耦**：同一个命令可以被快捷键、菜单、按钮、右键菜单触发，快捷键不直接调用 store、history、fabric 等业务 API。
- **平台差异**：使用 `mod` 表示主修饰键，注册时展开为 `command` 和 `ctrl`，兼容 macOS 与 Windows / Linux。
- **快捷键冲突**：同一作用域下相同按键会被规范化后检查，例如 `mod+z` 展开后会检测 `command+z` 和 `ctrl+z`。默认策略是 `warn` 并跳过冲突，也支持 `override`、`ignore`、`error`。
- **作用域隔离**：默认作用域是 `global`。弹窗、文本编辑、快捷键面板等场景可以使用独立 scope，避免同一个按键在不同上下文里误触发。
- **栈式作用域恢复**：进入临时 scope 时记录之前的 scope，退出时恢复，适合 React 组件挂载 / 卸载场景。
  当前阶段，一个 active scope 加 all 已经够用了。
- **输入区域保护**：默认在 `input`、`textarea`、`select`、`contentEditable` 中不触发快捷键，避免影响用户输入。
- **浏览器默认行为控制**：默认 `preventDefault`，避免浏览器撤销、保存、查找等默认行为抢占编辑器行为；特殊快捷键可显式关闭。
- **集中注册与可枚举**：内置快捷键使用声明式配置批量注册，并可通过 `shortcutManager.list()` 枚举，便于后续做快捷键设置面板或调试工具。

### 当前注册方式

内置快捷键在 `apps/editor/src/core/shortcut/builtins.ts` 中声明：

```ts
shortcutManager.registerMany([
  {
    keys: 'mod+z',
    commandId: 'editor.undo',
    scope: 'global',
  },
  {
    keys: 'mod+shift+z, mod+y',
    commandId: 'editor.redo',
    scope: 'global',
  },
]);
```

对应命令需要先在 `CommandManager` 中注册：

```ts
commandManager.register({
  id: 'editor.undo',
  title: '撤销',
  run: () => history.undo(),
});
```

### 作用域使用示例

当弹窗打开时进入 `modal` 作用域，弹窗关闭时恢复进入前的作用域：

```ts
useEffect(() => {
  const leaveScope = shortcutManager.enterScope('modal');

  return () => {
    leaveScope();
  };
}, []);
```

`enterScope('modal')` 会返回一个退出函数。调用这个退出函数时，会把快捷键作用域恢复到进入 `modal` 之前的状态。

### 冲突处理示例

默认冲突策略是 `warn`，即发现同一 scope 下已有绑定时跳过新绑定并打印警告。需要覆盖已有绑定时，可以使用 `override`：

```ts
shortcutManager.register('mod+z', 'history.customUndo', {
  scope: 'global',
  conflict: 'override',
});
```

如果希望开发阶段强制暴露冲突，可以使用 `error`：

```ts
shortcutManager.register('mod+z', 'history.customUndo', {
  scope: 'global',
  conflict: 'error',
});
```

### 可扩展快捷键系统的设计原则

- **统一入口**：项目中只能通过 `ShortcutManager` 注册快捷键，不在业务组件中直接使用 `hotkeys-js` 或 `window.addEventListener('keydown')`。
- **声明式配置**：内置快捷键、插件快捷键、用户自定义快捷键都应使用 `ShortcutRegistration` 这种数据结构描述，便于持久化、校验和 UI 展示。
- **命令优先**：新增能力时先注册 command，再绑定快捷键。快捷键只关心 `commandId`，不关心命令内部实现。
- **作用域优先于条件判断**：弹窗、右键菜单、文本编辑等上下文尽量用 scope 隔离，而不是在每个 handler 里堆条件。
- **冲突显式化**：所有注册都经过冲突检测；业务方根据场景选择 `warn`、`override`、`ignore` 或 `error`，不要静默覆盖。
- **可执行性下沉到命令层**：某个命令当前是否能执行，应由 `Command.canExecute` 判断，而不是由快捷键层判断。例如没有选中元素时，`widget.delete` 应返回不可执行。
- **可观测与可配置**：保留 `list()` 能力，后续可以基于它实现快捷键说明、设置面板、冲突提示和用户自定义方案导入导出。
