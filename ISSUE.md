# Breadcrumb 组件增强

## 需求描述

我需要给 Nuxt UI 的 Breadcrumb 面包屑组件做几个重要增强：

1. **最后一项不可点击**：面包屑的最后一项代表当前页面，用户不应该能点击它跳转。即使开发者不小心给最后一项设置了 `to` 属性，组件也应该在代码层面强制忽略，不让用户跳走。

2. **长路径折叠**：当面包屑层级很深（比如超过 5 层），全部显示会占满一整行。我希望能设置一个 `max-items` 属性，超过这个数量就把中间的项折叠成省略号（...），只保留第一项和最后一项。

3. **分隔符可自定义**：默认的分隔符是右箭头图标，但我希望能用简单的字符串（比如 `>` 或 `/`）作为分隔符，用起来更方便。

4. **无障碍支持**：面包屑需要满足屏幕阅读器和 SEO 的要求，包括 `<nav aria-label>` 包裹、最后一项 `aria-current="page"`、分隔符对屏幕阅读器隐藏。

5. **空数组不报错**：如果 `items` 是空数组或没传，组件不应该渲染任何东西，也不要报错。

## 修改的文件

| 文件 | 改了什么 |
|------|----------|
| `src/runtime/components/Breadcrumb.vue` | 核心逻辑：三重防护让最后一项不可点击、折叠算法、separator 字符串支持、v-if 空数组降级、aria-label 省略号 |
| `src/theme/breadcrumb.ts` | 新增 separatorLabel/ellipsisIcon slot、active 加 pointer-events-none + cursor-default、hover 加下划线、间距从 gap-1.5 调到 gap-x-2.5 |
| `docs/content/docs/2.components/breadcrumb.md` | 新增 Separator String 和 Max Items 两个章节 |
| `test/components/Breadcrumb.spec.ts` | 新增折叠测试、空数组测试、separator 字符串测试 |
| `playgrounds/nuxt/app/pages/index.vue` | 清理验证代码，恢复原始状态 |

## 验收步骤

### 步骤 1：安装依赖并启动 Playground

```bash
pnpm install
pnpm run dev:prepare
pnpm run dev
```

打开浏览器访问 `http://localhost:3000`，确认页面正常加载不报错。

### 步骤 2：验证最后一项不可点击

在 Playground 首页或任意页面添加以下代码：

```vue
<UBreadcrumb
  :items="[
    { label: '首页', to: '/' },
    { label: '组件', to: '/components' },
    { label: '面包屑', to: '/should-not-navigate' }
  ]"
/>
```

**看哪里**：最后一项"面包屑"
**应该看到**：
- 文字颜色是主题色（高亮），不是灰色
- 鼠标悬停时，光标是默认箭头（不是手型 pointer）
- 点击"面包屑"不会跳转到 `/should-not-navigate`

### 步骤 3：验证折叠功能

```vue
<UBreadcrumb
  :items="[
    { label: '首页', to: '/' },
    { label: '产品', to: '/products' },
    { label: '电子产品', to: '/products/electronics' },
    { label: '手机', to: '/products/electronics/phones' },
    { label: 'iPhone 15', to: '/iphone-15' }
  ]"
  :max-items="3"
/>
```

**看哪里**：面包屑渲染结果
**应该看到**：
- 只显示 3 个项：`首页 > ... > iPhone 15`
- 中间有一个省略号图标（默认是 `i-lucide-ellipsis`）
- "首页"和"iPhone 15"都可以点击跳转
- 省略号不可点击

### 步骤 4：验证分隔符字符串

```vue
<UBreadcrumb
  :items="[
    { label: '首页', to: '/' },
    { label: '组件', to: '/components' },
    { label: '面包屑', to: '/breadcrumb' }
  ]"
  separator=">"
/>
```

**看哪里**：项之间的分隔符
**应该看到**：
- 分隔符是文字 `>` 而不是箭头图标
- `>` 和文字之间有适当间距，不会紧贴

### 步骤 5：验证空数组不报错

```vue
<UBreadcrumb :items="[]" />
<UBreadcrumb />
```

**看哪里**：页面控制台和渲染结果
**应该看到**：
- 页面不报错
- 两个组件都不渲染任何 DOM 元素

### 步骤 6：运行单元测试

```bash
pnpm run test -- --run test/components/Breadcrumb.spec.ts
```

**看哪里**：测试输出
**应该看到**：
- 所有测试用例通过
- 包含 `renders ellipsis icon when items exceed maxItems` 测试
- 包含 `renders nothing when items is empty` 测试

### 步骤 7：运行 Lint 和类型检查

```bash
pnpm run lint
pnpm run typecheck
```

**看哪里**：命令输出
**应该看到**：
- Lint 零错误
- TypeCheck 零错误
