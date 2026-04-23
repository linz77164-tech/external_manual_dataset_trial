# ISSUE: 实现 SVG 路径插值的液态文字变形动画（Morphing Text）

## 需求背景

现有的文字动画太死板了——切文字就是硬切、淡入淡出，或者顶多加个缩放旋转，毫无灵魂。我想要一个像液体一样流动的 Morphing 效果：一个字变成另一个字的时候，笔画能像水一样平滑过渡，不是整体缩放，而是每一条笔画路径都在流动、变形、重组。

想象一下 "MAGIC UI" 变成 "WOW"——字母的骨架拆开、流动、重新拼合，中间没有任何断裂感，笔画始终圆润，像融化的金属倒进新模具。而且要有物理感，不是匀速的机械运动，而是像弹簧一样有点粘滞、有点回弹，停下来的时候还有一个小小的 overshoot。

## 核心攻关点

### 1. 路径重采样算法 — 解决不同字符点数不一致导致的撕裂

**问题**：不同字符的 SVG 路径点数完全不同。"I" 可能只有十几个控制点，"W" 有一百多个。直接做点对点插值（lerp），要么点数对不上直接报错，要么强行对齐后路径疯狂撕裂——一笔画飞到另一个字完全不相干的位置。

**解决**：

- **Flatten**：把所有 Bézier 曲线递归展开为折线（polyline），消除曲线类型差异
- **Arc-length Resample**：按弧长均匀重采样到相同点数。支持两种模式：
  - `numSamples: 200`（固定模式，所有子路径统一 200 点）
  - `samplesPerUnit: 2`（动态模式，按周长自动计算采样数，短路径不会过密，长路径不会过疏）
- **Centroid Rotation**：闭合路径的起始点位置不影响形状但影响插值方向。对齐时旋转起始点到对面路径质心最近的位置，消除"旋转撕裂"
- **性能哨兵**：实时监测每帧插值耗时，超过 16ms 预算自动降采样（×0.7），有空余自动恢复（×1.3）

### 2. SSR 兼容性修复 — 解决 opentype.js 在 Next.js 服务端崩溃

**问题**：opentype.js 是纯浏览器库，依赖 `fetch`、`ArrayBuffer`、DOM API。Next.js 服务端渲染（SSR）时执行到 `import("opentype.js")` 就炸了，报 `ReferenceError: fetch is not defined` 或者 `document is not defined`，整站 500。

**解决**：

- **动态导入**：用 `await import("opentype.js")` 代替静态 import，确保 opentype.js 不会被 SSR bundle 打包
- **单例 FontManager**：`getFontManager()` 在服务端返回一个空壳实例，客户端才创建真正的 singleton
- **三层容错加载**：远程字体 → 本地 `/fonts/xxx.ttf` → 合成最小字体（opentype.js 创建只有一个 notdef glyph 的 Font 对象）。任何一层失败都不会崩溃
- **next/dynamic + ssr: false**：MorphingText 组件通过 `dynamic(() => import(...), { ssr: false })` 加载，SSR 时显示静态 `<span>` 占位
- **本地化字体资源**：所有字体文件放在 `public/fonts/` 下，用 `/fonts/Inter-Bold.ttf` 绝对路径加载，零网络依赖

### 3. 弹簧物理引擎 — 使用 motion 的 useSpring 实现粘滞感

**问题**：线性插值（lerp）的 morphing 像机器人在写字，匀速、僵硬、没有生命力。需要物理感：启动有惯性、停下有回弹、整个过渡有重量感。

**解决**：

- **useSpring**：来自 `motion/react`（原 framer-motion）的弹簧动画原语
  - `stiffness: 200` — 弹簧刚度，越高越"脆"，回弹快
  - `damping: 20` — 阻尼系数，越低越"弹"，overshoot 明显
  - `restDelta: 0.001` — 静止判定阈值
- **触发方式**：
  - `trigger="auto"`：自动循环，每个 interval 秒触发一次 morph
  - `trigger="hover"`：鼠标悬停 morph 到目标，离开弹簧回弹到原位
- **onMorphComplete 回调**：当 spring 值 t > 0.998 时触发，通知调用方变形已完成
- **spring settle 估算**：`(4 * damping) / stiffness + 0.3` 估算弹簧稳定时间，用于自动循环的间隔计算

### 4. 多闭合路径处理 — 解决字母 'B'、'O' 这种"洞"的变形逻辑

**问题**：一个字符经常包含多个闭合子路径。'O' 有外圈 + 内圈（洞），'B' 有外圈 + 上洞 + 下洞。变形时如果洞和轮廓配对错了，洞会"飞出"轮廓外面，或者两个洞交叉穿越，视觉上完全崩坏。更极端的情况：'O'（有洞）变 'M'（没洞），那个洞去哪？如果硬配，洞就消失了（画面闪烁）；如果不管，洞就乱跑。

**解决**：

- **绕向检测（Winding Detection）**：用 Shoelace 公式计算子路径的有符号面积
  - 正面积 → 逆时针 → 外轮廓（outline）
  - 负面积 → 顺时针 → 内洞（hole）
- **多因子代价匹配**：替代原来的纯质心距离贪心匹配
  - **绕向惩罚**（weight 2.0）：洞↔轮廓交叉配对直接 +2.0 代价，强制洞配洞、轮廓配轮廓
  - **面积相似度**（weight 0.8）：`|relA - relB| / max(relA, relB)`，大轮廓配大轮廓
  - **位置距离**（weight 0.5）：质心距离归一化到路径尺度
  - 按总代价排序，贪心分配最优配对
- **洞收缩消失（Hole Shrink-to-Center）**：
  - 当 'O'（2 子路径）→ 'M'（1 子路径），'O' 的洞没有配对目标
  - **旧方案**：ghost 放在全局质心 → 洞飞到字符外面消失（视觉崩坏）
  - **新方案**：`findParentOutlineCentroid()` 找到洞所属的最小外轮廓质心 → ghost 放在父轮廓质心 → 洞向内收缩至消失（自然的"填洞"效果）
  - 反向（'M' → 'O'）时，ghost 从轮廓中心向外膨胀成洞

### 5. Catmull-Rom 平滑输出 — 消除折线感

**问题**：重采样后的点集是线性连接的（L 命令），变形时转角处显得生硬，像多边形而不是圆润的笔画。

**解决**：

- Catmull-Rom → Cubic Bézier 转换
- 每个线段用相邻 4 个点（P_{i-1}, P_i, P_{i+1}, P_{i+2}）计算切线
- TENSION = 0.5 控制平滑紧度
- 输出 `C`（cubic Bézier）命令替代 `L`（line）命令
- C1 连续（一阶导数连续），笔画在任何变形瞬间都保持圆润

### 6. 视觉增强 — Neon Glow + Inner Shadow

- **Neon Glow**：三层高斯模糊（stdDeviation 3/8/16）+ 渐变动画叠加
- **Inner Shadow**：SourceAlpha → Blur → Offset → Flood(0.5 opacity) → Composite(clip inside) → Merge，给笔画添加方向性内阴影，产生厚度感
- **Combined Filter**：`neon-glow-depth` = inner shadow + neon glow + source，既有外发光又有内深度

---

## 验收标准

### 步骤 1：启动开发服务器

```bash
cd apps/www
npm run dev -- -p 3001
```

打开浏览器访问 `http://localhost:3001`，页面应正常渲染，**无 500 错误**。

### 步骤 2：鼠标悬停触发

在首页 Hero 区域找到文字区域（显示 "MAGIC UI"），将鼠标悬停在文字上：

- [ ] 鼠标进入后，文字开始从 "MAGIC UI" 流动变形为 "WOW"
- [ ] 变形过程平滑，无撕裂、无闪烁
- [ ] 变形有粘滞感（不是匀速的，有减速和微弱回弹）
- [ ] 鼠标离开后，文字弹簧回弹到 "MAGIC UI"

### 步骤 3：观察笔画平滑度

在变形过程中仔细观察笔画边缘：

- [ ] 笔画转角处圆润，无明显的折线/锯齿感（Catmull-Rom 平滑生效）
- [ ] 带洞字母（如 'O'）的洞不会飞出轮廓外（绕向配对生效）
- [ ] 字母变形时笔画有厚度感（inner shadow 生效）
- [ ] 外发光效果渐变流动（neon glow + gradient animation 生效）

### 步骤 4：检查控制台无报错

打开浏览器 DevTools → Console：

- [ ] **无红色错误**（TypeError / ReferenceError / Network Error）
- [ ] **无 "Hover State" 日志**（调试代码已清除）
- [ ] 允许的黄色 warn：`[svg-path-utils]` 或 `[FontLoader]` 前缀的防御性日志（仅在异常路径触发）

### 步骤 5：性能检查

在 DevTools → Performance 面板录制一段悬停变形：

- [ ] 单帧插值耗时 < 16ms（性能哨兵自动降采样保障）
- [ ] 无明显掉帧（fps 稳定在 55+）

### 步骤 6：SSR 验证

强制刷新页面（Ctrl+Shift+R）：

- [ ] 页面正常加载，无 hydration mismatch 警告
- [ ] 首屏可见静态文字占位（MorphingText 尚未加载时）
- [ ] 字体加载完成后平滑切换到 SVG 动画，无闪烁

---

## 涉及文件

| 文件 | 职责 |
|---|---|
| `components/magicui/morphing-text.tsx` | 主组件：字体加载、路径准备、弹簧驱动、性能哨兵、onMorphComplete 回调 |
| `registry/lib/svg-path-utils.ts` | 几何算法：parse/flatten/resample/centroid-align/interpolate/Catmull-Rom smoothing/绕向配对/洞收缩 |
| `registry/lib/font-loader.ts` | 字体管理：FontManager 单例、三层容错加载、缓存、SSR 安全 |
| `components/sections/hero-title.tsx` | 使用示例：Neon Glow + Inner Shadow SVG filter、hover 模式配置 |
| `lib/utils.ts` | `cn()` 工具函数（clsx + tailwind-merge） |
| `public/fonts/Inter-Bold.ttf` | 粗体字体文件（零网络依赖） |
| `public/fonts/Inter-Regular.ttf` | 常规字体文件（零网络依赖） |

## 依赖

| 包 | 版本 | 用途 |
|---|---|---|
| `next` | ^14.2.0 | 框架（SSR/dynamic import/App Router） |
| `react` | ^18.3.0 | UI 渲染 |
| `motion` | ^11.15.0 | useSpring 弹簧物理引擎 |
| `opentype.js` | ^1.3.4 | TrueType 字体解析为 SVG 路径 |
| `clsx` | ^2.1.0 | 条件 className |
| `tailwind-merge` | ^2.5.0 | Tailwind class 去重合并 |
