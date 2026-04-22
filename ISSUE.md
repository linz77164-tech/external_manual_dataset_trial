我想做一个验证码输入框，要能自动跳到下一格，还要支持粘贴 6 位数字一次性填满，输入完要触发回调，空格要能高亮提示用户该填哪个

## 修改的文件

| 文件 | 改了什么 |
|------|----------|
| `src/runtime/components/OTPInput.vue` | 新增 OTP 输入框组件：基于 PinInput 实现，支持长度自定义、粘贴、遮罩、高亮、自动聚焦 |
| `src/theme/otp-input.ts` | 新增 OTP 主题：定义 root/base/separator/placeholder 等插槽样式，支持 size/variant/color 变体 |
| `src/runtime/types/index.ts` | 导出 OTPInput 相关类型 |
| `src/theme/index.ts` | 注册 otp-input 主题 |
| `docs/content/docs/2.components/otp-input.md` | 新增 OTPInput 组件文档：Usage、Props、Events、Examples |
| `test/components/OTPInput.spec.ts` | 新增测试：长度验证、complete 事件、blur 事件、表单集成、无障碍 |
| `playgrounds/nuxt/app/pages/components/otp-input.vue` | 新增 Playground 页面 |
| `playgrounds/nuxt/app/composables/useNavigation.ts` | 添加 OTPInput 导航项 |
| `playgrounds/nuxt/app/pages/index.vue` | 清理首页验证代码 |

## 验收步骤

### 步骤 1：安装依赖并启动 Playground

```bash
cd final
pnpm install
pnpm run dev:prepare
pnpm run dev
```

打开浏览器访问 `http://localhost:3000`，导航到 Components > OTPInput 页面。

### 步骤 2：验证基本输入

在 Playground 页面看到 OTP 输入框：
- 默认显示 6 个输入格
- 输入一个数字后，光标自动跳到下一格
- 按 Backspace 可以删除并回退到上一格

### 步骤 3：验证粘贴功能

复制一串 6 位数字（如 `123456`），粘贴到第一个输入格：
- 所有 6 个格自动填满
- 触发 `complete` 事件，输出拼接的字符串

### 步骤 4：验证 length 属性

设置 `:length="4"`：
- 只显示 4 个输入格
- 输入 4 位后触发 `complete`

### 步骤 5：验证 mask 和 highlight

设置 `mask` 属性：
- 输入的数字显示为 `●`（遮罩模式）

设置 `highlight` 属性：
- 未填的输入格显示高亮边框

### 步骤 6：运行单元测试

```bash
sh run-tests.sh
```

**应该看到**：
- 所有测试用例通过
- 包含 `renders correct number of inputs based on length prop` 测试
- 包含 `complete event with joined string` 测试
- 包含 `passes accessibility tests` 测试

### 步骤 7：运行 Lint 和类型检查

```bash
cd final
pnpm run lint
pnpm run typecheck
```

**应该看到**：Lint 零错误，TypeCheck 零错误
