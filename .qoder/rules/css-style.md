请严格遵守以下前端样式规范生成代码：

【强制】

1. 所有组件样式必须使用 \*.module.scss
2. 每个组件必须独立维护 style.module.scss
3. 覆盖 Ant Design 样式必须使用 :global(.ant-xxx)
4. 复杂业务样式必须写在 SCSS Module 中
5. CSS Module 类名必须使用 camelCase

【推荐】

1. 布局、间距、Flex、Grid、字体、响应式 优先使用 TailwindCSS
2. 复杂组件、动画、主题、第三方覆盖、业务样式 优先使用 SCSS Module
3. SCSS 嵌套层级不超过 3 层
4. 颜色、间距、z-index 必须使用 src/styles/variables.scss 变量

【禁止】

1. 禁止使用全局选择器：\* / body / html / div / a / button
2. 禁止使用 !important（必须使用时必须加注释）
3. 禁止大段 inline-style
4. 禁止滥用 Tailwind 任意值，如 w-[123px]、text-[17px]

请按照以上规范生成完整的 tsx + scss 代码。
