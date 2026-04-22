# Breadcrumb 组件增强 — 任务总结

## 任务背景

基于 Nuxt UI 仓库，对 `Breadcrumb` 面包屑组件进行全面功能增强，包括交互安全防护、折叠展示、分隔符定制、无障碍增强等多项改进。

---

## 修改清单

### 新增文件

| 文件 | 说明 |
|------|------|
| `docs/content/docs/2.components/breadcrumb.md` | 完整组件文档（Separator String / Max Items 章节） |
| `test/components/Breadcrumb.spec.ts` | 单元测试（含折叠、空数组、无障碍验证） |

### 修改文件

| 文件 | 修改内容 |
|------|----------|
| `src/runtime/components/Breadcrumb.vue` | 核心逻辑重构：三重不可点击防护、折叠算法、separator 字符串、v-if 降级、aria 增强 |
| `src/theme/breadcrumb.ts` | 新增 separatorLabel / ellipsisIcon slot、active 状态 pointer-events-none + cursor-default、hover 下划线增强、间距优化 |

---

## 核心代码解析

### 1. 三重不可点击防护

确保面包屑最后一项（当前页面）绝对不可点击，即使开发者误设 `to` 属性：

```ts
// 第一重：逻辑层 — 剥离 to 属性
pickLinkProps(active ? { ...item, to: undefined } : item)

// 第二重：样式层 — 禁用 + 禁止指针事件
disabled: !!(item.disabled || isActive)
to: isActive ? false : !!item.to

// 第三重：CSS 层 — pointer-events-none + cursor-default
active: { true: { link: 'text-primary font-semibold pointer-events-none cursor-default' } }
```

### 2. 折叠算法（visibleItems computed）

当 `items.length > maxItems` 时，保留首尾项，中间替换为省略号：

```ts
const visibleItems = computed(() => {
  // 保底：2 项及以下不折叠
  if (items.length <= 2 || !maxItems || items.length <= maxItems) {
    return items.map(...)
  }

  // 首项保护：headCount >= 1
  const headCount = Math.max(1, Math.ceil((max - 1) / 2))
  const tailCount = Math.max(1, max - headCount)

  return [...head, { type: 'overflow' }, ...tail]
})
```

**关键设计决策：**
- `maxItems` 不含省略项本身
- `items.length <= 2` 强制不折叠（防御 max-items=1 误设）
- 首项 `Math.max(1, ...)` 始终保留
- 省略项通过 `#overflow` 插槽可自定义

### 3. 分隔符增强

- **`separator` 字符串 prop**：`separator=">"` 替换默认图标，优先级高于 `separatorIcon`
- **主题适配**：新增 `separatorLabel: 'text-muted text-sm'` slot
- **间距优化**：`list` 从 `gap-1.5` 调整为 `gap-x-2.5 gap-y-1`，分隔符不再紧贴文字

### 4. 空数组优雅降级

```html
<Primitive v-if="items?.length" ...>
```

`items` 为空数组或 `undefined` 时，组件不渲染任何 DOM。

### 5. SEO 与无障碍增强

| 特性 | 实现 |
|------|------|
| `<nav aria-label="breadcrumb">` | Primitive 默认渲染为 `<nav>` |
| `aria-current="page"` | 最后一项自动添加 |
| 分隔符隐藏 | `role="presentation" aria-hidden="true"` |
| 省略号标签 | `aria-label="显示更多路径"` |
| 语义化结构 | `<ol>` + `<li>` 有序列表 |

### 6. 交互体验优化

- **非 active 可链接项**：hover 时颜色加深 + 下划线（`hover:text-default hover:underline underline-offset-4`）
- **active 项**：`pointer-events-none` + `cursor-default`，悬停时保持默认箭头
- **省略号图标**：默认 `i-lucide-ellipsis`，可通过 `ellipsisIcon` prop 或 `#overflow` 插槽自定义

---

## 主题配置最终版

```ts
// src/theme/breadcrumb.ts
{
  slots: {
    root: 'relative min-w-0',
    list: 'flex items-center gap-x-2.5 gap-y-1',
    item: 'flex min-w-0',
    link: 'group relative flex items-center gap-1.5 text-sm min-w-0 focus-visible:outline-primary',
    linkLeadingIcon: 'shrink-0 size-5',
    linkLeadingAvatar: 'shrink-0',
    linkLeadingAvatarSize: '2xs',
    linkLabel: 'truncate',
    separator: 'flex',
    separatorLabel: 'text-muted text-sm',       // 新增
    separatorIcon: 'shrink-0 size-5 text-muted',
    ellipsisIcon: 'shrink-0 size-5 text-muted'  // 新增
  },
  variants: {
    active: {
      true: { link: 'text-primary font-semibold pointer-events-none cursor-default' },
      false: { link: 'text-muted font-medium' }
    },
    disabled: {
      true: { link: 'cursor-not-allowed opacity-75' }
    }
  },
  compoundVariants: [{
    disabled: false, active: false, to: true,
    class: { link: ['hover:text-default hover:underline underline-offset-4', transitions && 'transition-colors'] }
  }]
}
```

---

## 验证结果

| 验证项 | 结果 |
|--------|------|
| Playground 首页基础渲染 | ✅ 通过 |
| 最后一项不可点击（三重防护） | ✅ 通过 |
| 折叠展示（7 项 → 3 项 + 省略号） | ✅ 通过 |
| separator 字符串替换图标 | ✅ 通过 |
| 空数组不渲染 | ✅ 通过 |
| 单元测试（折叠/空数组/无障碍） | ✅ 通过 |
| Linter 检查 | ✅ 零错误 |
| hover 下划线交互效果 | ✅ 通过 |
| active 项 cursor-default | ✅ 通过 |

---

## 新增 Props

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `separator` | `string` | — | 字符串分隔符，优先于 `separatorIcon` |
| `maxItems` | `number` | `undefined` | 最大可见项数（不含省略项），≤2 时不折叠 |
| `ellipsisIcon` | `IconProps['name']` | `i-lucide-ellipsis` | 省略号图标 |

## 新增 Slots

| Slot | 说明 |
|------|------|
| `separatorLabel` | 字符串分隔符容器 |
| `ellipsisIcon` | 省略号图标 |
| `overflow` | 省略项完整自定义 |
