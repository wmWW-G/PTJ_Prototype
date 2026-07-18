# Design QA

## 2026-07-16 真实生图后端原型验收

- implementation screenshot: `/Users/garden/.codex/visualizations/2026/07/16/019f686c-fda5-7bf1-bbef-ccd5548bd10b/ptj-real-backend-prototype.png`
- route: `http://127.0.0.1:5173/PTJ_Prototype/`
- page: 批量文生图 / 套图 / Nano Banana 2 / 2K / 1:1
- result: passed

本次浏览器验收确认：

- 页面正常加载，正文非空，无 Vite 错误覆盖层。
- 三个真实模型均出现在模型选择中。
- Google 模型显示 1K/2K/4K，4K 标记 Preview。
- 切换 OpenRouter GPT-Image-2 后，输出清晰度直接展示低/中/高质量档。
- 套图明确显示“每版 6 张”和“1 版 × 6 张 = 6 张”。
- 左侧真实参数区与原橙色品牌风格一致，右侧历史结果工作台未被破坏。
- 浏览器首次检查发现 `127.0.0.1` CORS 缺项；修复后从页面上下文请求 `/api/capabilities` 返回 `CORS_OK`。
- 后端 `/api/health` 和 `/api/capabilities` 均返回 200；缺少真实密钥时 health 只列变量名，不回显值。

当前未执行收费真实模型 Smoke Test，因为本地没有注入 Vercel 密钥；代码不会静默回退 Mock。

- source visual truth: `/var/folders/94/2dlbsm3968j4rqjll_d32qb40000gn/T/codex-clipboard-e87cfb8c-2213-466e-9457-e7473b0e6f0c.png`
- implementation screenshot: `/Users/garden/.codex/visualizations/2026/07/15/019f63a5-d31a-7df2-b66c-fce7d960d7c6/ptj-redesign-text-qa-1308x1024.png`
- intended viewport: 1440 × 1024 desktop
- browser capture: 1308 × 1024（Codex 内置浏览器可用内容区宽度）
- state: 批量文生图 / 套图 / 生成中 4/6 / 网格视图 / 1:1

## Full-view comparison evidence

已在同一次视觉比较中同时打开原始设计图和浏览器实现截图。两者均采用固定顶部栏、左侧业务导航、左侧配置表单和右侧单任务结果工作台。主要区域比例、步骤条、四类图片选择、3 × 2 套图网格、元数据条、操作按钮和底部任务状态保持一致。

浏览器截图宽度受内置浏览器内容区限制，比源图少 179px；实现使用响应式网格收窄了左右两栏，但没有隐藏关键操作、产生横向滚动或改变信息层级。

## Focused region comparison evidence

源图和实现截图在原始分辨率下均可直接辨认以下重点区域，因此未额外裁剪：

- 顶部导航、余额与账户区。
- 左侧三步流程、图片类型和固定张数说明。
- 产品卖点、数量、模型、LOGO 和尺寸控件。
- 右侧进度、六张套图、选中态、图片角色标签。
- 任务元数据、重新编辑、再次生成、全部下载和底部状态。

## Findings

- 无 P0 / P1 / P2 问题。
- [P3] 源图使用 1487px 宽截图，实现验收截图为 1308px 宽，因此右侧结果区略紧凑；在可用宽度内仍保持 3 × 2 网格和完整操作区，属于预期响应式差异。

## Required fidelity surfaces

- 字体与排版：使用 Avenir Next、苹方和微软雅黑回退；标题、步骤、表单标签、辅助文本和结果元数据层级与源图一致，无异常换行或截断。
- 间距与布局节奏：双栏工作台、14px 圆角、细边框、低阴影和紧凑表单节奏一致；内置浏览器较窄时仍保持稳定。
- 颜色与视觉令牌：主色保持 `#F28C18` 橙色，搭配暖白、浅灰和深灰文字；没有紫色品牌漂移。
- 图片质量与素材保真：六张商品图为独立生成并压缩的真实 JPEG 素材，主题、裁切、暖光和奶油色调与源图一致；未使用占位图或 CSS 图形替代。
- 文案与内容：保留主图 1 张、套图 6 张、详情图 5 张、海报 1 张，以及产品卖点、模型、LOGO、比例、任务状态和下载操作。

## Interaction verification

- 文生图：切换套图、填写产品卖点、点击开始生成、生成 6 张结果均通过。
- 结果区：网格/列表视图切换、图片选择、重新编辑、再次生成和下载提示均可操作。
- 图生图：路由切换、上传商品参考图入口、共用结果面板和 6 张套图结果均通过。
- 浏览器控制台：无 error。
- 自动化测试：14 项通过。
- 生产构建：通过。

## Comparison history

1. 第一次比较发现默认演示任务显示“已完成”且描述过短，和源图“正在生成 4/6”的状态不一致。
2. 将默认套图任务改为生成中状态，并补齐产品描述；同时让演示任务按时间排序，保证套图任务默认置顶。
3. 再次捕获并比较，进度、内容、六图网格和操作区已对齐，未留下 P0 / P1 / P2 问题。

## Implementation checklist

- [x] 文生图和图生图共用新版结果工作台。
- [x] 四类图片固定张数清晰可见。
- [x] 六张套图使用真实本地素材。
- [x] 生成中、完成、空态和加载态均可见。
- [x] 1440 桌面设计在内置浏览器可用宽度下通过响应式检查。

## Follow-up polish

- 可在下一轮补充 760px 以下移动端的专门视觉稿；当前已具备基础响应式布局，但本次目标仅为桌面端。

final result: passed

---

## 2026-07-16 生图模板与选填信息验收

- source visual truth: `/Users/garden/.codex/generated_images/019f686c-fda5-7bf1-bbef-ccd5548bd10b/exec-36ec3de4-58b8-4e9f-acd8-25718b8bce42.png`
- implementation screenshot: `/Users/garden/.codex/visualizations/2026/07/16/019f686c-fda5-7bf1-bbef-ccd5548bd10b/product-design-audit/09-template-drawer-source-assets.png`
- combined comparison: `/Users/garden/.codex/visualizations/2026/07/16/019f686c-fda5-7bf1-bbef-ccd5548bd10b/product-design-audit/10-source-vs-final-assets.png`
- route: `http://127.0.0.1:5173/PTJ_Prototype/#/image-to-image`
- state: 批量图生图 / 套图 / 企业实力模板抽屉

### Required fidelity surfaces

- 字体与排版：沿用现有橙色品牌系统；抽屉标题、分类、模板名、说明和信息重点层级与选中稿一致。
- 间距与布局：模板摘要保持紧凑；抽屉固定于视口右侧，遮罩、滚动区和底部确认按钮在 1280 × 720 内容区完整可见。
- 图片保真：企业实力卡改用工厂外观、仓储、研发和品控的真实栅格预览，不再用商品杯子素材冒充企业信息。
- 文案与交互：支持推荐、商品展示、企业实力、极简质感分类；选择企业实力后显示工厂历史、OEM/ODM、质量控制、交付服务和认证背书。
- 状态连续性：模板先作为抽屉草稿，点击“使用此模板”才提交；已填写信息计数实测从 0/8 更新为 2/8。

### Findings and fixes

1. [P1 已修复] 初版企业实力卡仍显示马克杯，无法表达模板预期；已替换为四张企业实力拼贴预览。
2. [P1 已修复] 抽屉最初被父级入场动画建立的 containing block 限制，底部按钮落在首屏外；改用 React Portal 挂载到 `document.body` 后固定铺满视口。
3. [P2 已修复] 初版选中卡只展示图片槽位名，信息丰富度不足；改为展示当前模板的信息重点。
4. 无遗留 P0 / P1 / P2 问题。

### Interaction verification

- “更换模板”打开右侧抽屉：通过。
- 分类切换、模板卡选择、确认模板：通过。
- 企业实力动态字段展开、公司名称和认证信息录入：通过。
- 选填信息计数显示 `已填写 2/8`：通过。
- 后端 Capabilities 返回 4 套模板及选填字段：通过。
- Prompt Planner 收到视觉模板和已验证非空事实：通过。
- 后端 57 项、前端 30 项自动测试：通过。
- TypeScript 检查与生产构建：通过。

final result: passed
