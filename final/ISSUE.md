# ISSUE: 新增 OTPInput 组件

## 任务背景

为 Nuxt UI 组件库新增 `OTPInput` 组件，提供专用于一次性密码（One-Time Password）输入的交互体验。组件基于 Reka UI 的 `PinInput` 原语封装，默认 6 位数字输入，内置 OTP 自动填充、数字校验、自动焦点转移和完成回调。

---

## 修改清单

### 新增文件

| 文件路径 | 说明 |
|----------|------|
| `src/runtime/components/OTPInput.vue` | 核心组件源码 |
| `src/theme/otp-input.ts` | Tailwind Variants 主题配置 |
| `test/components/OTPInput.spec.ts` | 单元测试 |
| `docs/content/docs/2.components/otp-input.md` | 组件文档 |
| `playgrounds/nuxt/app/pages/components/otp-input.vue` | Playground 演示页面 |

### 修改文件

| 文件路径 | 修改内容 |
|----------|----------|
| `src/runtime/types/index.ts` | 新增 `export * from '../components/OTPInput.vue'` |
| `src/theme/index.ts` | 新增 `export { default as otpInput } from './otp-input'` |
| `playgrounds/nuxt/app/composables/useNavigation.ts` | 侧边栏导航数组中添加 `'otp-input'` |
| `playgrounds/nuxt/app/pages/index.vue` | 首页临时添加验证代码（提交前应还原） |

---

## 核心代码解析

### OTPInput.vue 实现架构

组件采用 Nuxt UI 标准的双 `<script>` 块结构：

**`<script lang="ts">` — 类型定义层**

```ts
// 基于 Reka UI PinInputRootProps<'number'> 派生 Props
export interface OTPInputProps extends Pick<PinInputRootProps<'number'>,
  'defaultValue' | 'disabled' | 'id' | 'mask' | 'modelValue' |
  'name' | 'placeholder' | 'required'> {
  color?: OTPInput['variants']['color']      // 主题色，默认 'primary'
  variant?: OTPInput['variants']['variant']  // 外观变体，默认 'outline'
  size?: OTPInput['variants']['size']         // 尺寸，默认 'md'
  length?: number | string                    // 输入框数量，默认 6
  autofocus?: boolean                         // 自动聚焦首个输入框
  autofocusDelay?: number                     // 自动聚焦延迟（毫秒）
  highlight?: boolean                         // 高亮环色
  fixed?: boolean                             // 保持移动端文字大小
  ui?: OTPInput['slots']                      // 自定义样式槽位
}

// 自定义 Emits，新增 complete 事件返回拼接字符串
export type OTPInputEmits = PinInputRootEmits<'number'> & {
  complete: [value: string]   // 所有格子填满时触发，如 "123456"
  change: [event: Event]
  blur: [event: FocusEvent]
}
```

**`<script setup lang="ts">` — 运行时逻辑层**

关键设计点：

1. **OTP 模式硬编码**：模板中 `PinInputRoot` 始终设置 `type="number"` 和 `:otp="true"`，确保浏览器可自动识别并填充短信验证码。

2. **三重数字校验**：
   - Reka UI `type="number"` — 框架层过滤非数字字符
   - `onKeydown` 正则拦截 — 在按键到达 input 前阻断非数字输入
   - `inputmode="numeric"` + `pattern="[0-9]"` — 移动端弹出数字键盘

```ts
const OTP_DIGIT_REGEX = /^[0-9]$/

function onKeydown(event: KeyboardEvent) {
  // 放行功能键：Backspace, Delete, Tab, Escape, Enter, 方向键
  if (['Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
        'ArrowLeft', 'ArrowRight'].includes(event.key)
    || ((event.ctrlKey || event.metaKey) && ['a', 'c', 'v', 'x'].includes(event.key))) {
    return
  }
  // 拦截非数字单字符
  if (event.key.length === 1 && !OTP_DIGIT_REGEX.test(event.key)) {
    event.preventDefault()
  }
}
```

3. **complete 事件**：Reka UI 的 `PinInputRoot` 在所有格子填满时触发 `complete` 事件，传入 `number[]`。组件将其拼接为字符串后发出：

```ts
function onComplete(value: number[]) {
  completed.value = true
  emits('complete', value.join(''))  // "123456"
  emits('change', event)
  emitFormChange()
}
```

4. **焦点管理**：
   - 自动焦点转移：由 Reka UI `PinInputInput` 内置处理（输入完一个自动跳下一个）
   - Backspace 回退：Reka UI 内置处理（当前格为空时按 Backspace 回退到前一格）
   - `autofocus` + `autofocusDelay`：组件挂载后延迟聚焦首个输入框

5. **表单集成**：通过 `useFormField` composable 集成 `UForm` 验证系统，支持 `emitFormInput`、`emitFormChange`、`emitFormBlur`。

6. **主题系统**：通过 `useComponentUI` + `tv()` 实现 Tailwind Variants 响应式主题，支持 color / variant / size / highlight / fixed 五个变体维度。

**`<template>` — 模板层**

```html
<PinInputRoot
  v-bind="{ ...rootProps, ...ariaAttrs }"
  type="number"
  :otp="true"
  @complete="onComplete"
>
  <PinInputInput
    v-for="(ids, index) in looseToNumber(props.length)"
    :index="index"
    inputmode="numeric"
    pattern="[0-9]"
    @keydown="onKeydown"
  />
</PinInputRoot>
```

---

## 验证结果

### Playground 验证

在 `playgrounds/nuxt/app/pages/index.vue` 中添加了验证代码：

```vue
<UOTPInput :length="4" highlight placeholder="○" @complete="onComplete" />
```

**验证结果**：
- ✅ 组件正常渲染 4 个输入框
- ✅ 输入数字后自动跳转到下一个输入框
- ✅ 输入非数字字符被拦截
- ✅ 所有格子填满后触发 `complete` 事件，控制台打印 `OTP complete: 1234`
- ✅ Backspace 清空当前格并回退焦点

### 单元测试覆盖

`test/components/OTPInput.spec.ts` 包含以下测试用例：

| 测试类别 | 用例 |
|----------|------|
| 渲染 | 按 `length` 渲染对应数量输入框 |
| 渲染 | 默认渲染 6 个输入框 |
| 渲染 | `length=4` 渲染 4 个输入框 |
| 快照 | 20+ 组 props/variants 的快照测试 |
| 事件 | `complete` 事件返回拼接字符串 `"123456"` |
| 事件 | `change` 事件在完成时触发 |
| 事件 | `blur` 事件正常触发 |
| 表单 | validate on change |
| 表单 | validate on blur |
| 表单 | validate on input |
| 无障碍 | axe 无违规 |

---

## Props 完整参考

| Prop | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `length` | `number \| string` | `6` | 输入框数量 |
| `color` | `string` | `'primary'` | 主题色 |
| `variant` | `string` | `'outline'` | 外观变体 |
| `size` | `string` | `'md'` | 尺寸 |
| `modelValue` | `number[]` | — | v-model 绑定 |
| `defaultValue` | `number[]` | — | 默认值 |
| `placeholder` | `string` | — | 占位符 |
| `mask` | `boolean` | — | 密码遮罩 |
| `disabled` | `boolean` | — | 禁用 |
| `required` | `boolean` | — | 必填 |
| `highlight` | `boolean` | — | 高亮环色 |
| `autofocus` | `boolean` | — | 自动聚焦 |
| `autofocusDelay` | `number` | `0` | 聚焦延迟 |
| `fixed` | `boolean` | — | 保持移动端字号 |
| `id` | `string` | — | HTML id |
| `name` | `string` | — | HTML name |
| `ui` | `object` | — | 自定义样式槽位 |

## Events 完整参考

| Event | 参数 | 说明 |
|-------|------|------|
| `complete` | `value: string` | 所有格子填满时触发 |
| `update:modelValue` | `value: number[]` | 值变化时触发 |
| `change` | `event: Event` | 完成时触发 |
| `blur` | `event: FocusEvent` | 失焦时触发 |

## Expose

| Name | Type |
|------|------|
| `inputsRef` | `Ref<ComponentPublicInstance[]>` |
