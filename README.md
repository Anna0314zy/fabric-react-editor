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
