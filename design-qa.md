# Design QA

## 2026-07-22 单图 AI 修改与模板提取验收

- source visual truth: `/Users/garden/.codex/generated_images/019f82b8-3f6c-77e1-bcd3-992baed95fd8/exec-257a132e-56d0-4495-b97e-6c06e0d225f2.png`
- browser-rendered implementation:
  - `/Users/garden/YD/批图匠/design-qa-assets/custom-slot-editor-v1.png`
  - `/Users/garden/YD/批图匠/design-qa-assets/custom-slot-editor-v2.png`
  - `/Users/garden/YD/批图匠/design-qa-assets/custom-slot-editor-accepted.png`
  - `/Users/garden/YD/批图匠/design-qa-assets/custom-slot-editor-700-v2.png`
- combined comparison evidence: `/Users/garden/YD/批图匠/design-qa-assets/source-vs-implementation.png`
- route: `http://127.0.0.1:5173/PTJ_Prototype/#/generation`
- viewport and normalization:
  - source pixels: 1487 × 1058。
  - implementation pixels / CSS viewport: 1440 × 1024，device scale factor 1。
  - 对比时把源图等比校准到 1440 × 1024，实现截图保持 1440 × 1024；合并证据为 2880 × 1024。
- state: 批量生图 / 套图 / 自定义套图 / 第 4 张 Logo 工艺展示 / AI 候选图对比 / 已采用并保存个人模板。

### Full-view comparison evidence

- 实现保持源稿的“大尺寸右侧抽屉 + 背景降暗”框架，自定义状态宽度为 86vw，并在 1440px 桌面视口限制为 1180px；模板列表仍使用原有窄抽屉，不扩大无关界面。
- 顶部依次为返回整套、居中槽位标题、AI 状态与关闭按钮；下方只保留 6 张缩略导航、原图 / 新版本对比、唯一自然语言输入框、模板提取提示和三个底部动作。
- 实现图片直接使用用户提供的三张棒球帽参考图，没有从整屏设计稿裁切素材，也没有使用占位图、CSS 图形或手绘 SVG。图片内容与源稿保持同一商品、白底、高信息密度和 Logo 工艺展示方向；参考图自带英文标题属于真实演示内容，不作为固定模板文案保存。

### Focused region comparison evidence

- 合并证据中已并列检查顶栏、缩略图选中态、双图对比、自然语言输入、真实数据提示、模板提取入口和底部按钮。重要文字在原始 1440px 截图可直接辨认，因此未额外裁切。
- 原图与候选图保持相同方形比例；候选图使用 2px 橙色描边和右上角确认图标，缩略图第 4 张同步使用橙色选中态。
- 用户只输入修改意图，界面没有标题、卖点或正文手填项；“保存为我的模板”在采用前禁用，采用后才允许保存。

### Required fidelity surfaces

- 字体与排版：沿用项目现有中文系统字体与 9–18px 产品字号；主标题、状态、图片标签、输入内容和辅助提示层级清楚，无截断或异常换行。
- 间距与布局节奏：桌面使用 6 张横向缩略图和双列对比，内容最大宽度 1000px；抽屉留白充足，底部操作固定且不遮挡桌面内容。
- 颜色与视觉令牌：继续使用批图匠橙色、暖白、浅棕灰边框和绿色成功状态；没有引入新的紫色、渐变或重阴影系统。
- 图片质量与资产保真：三张 1024 × 1024 用户参考图保持 1:1、完整显示且无拉伸；未使用临时网络资源、占位图或代码绘制替代。
- 文案与内容：唯一输入文案明确“文案由 AI 生成”；认证、MOQ、材质等内容只使用已确认资料，避免把图片中的未知数字沉淀为模板事实。
- 图标：返回、关闭、AI、刷新、确认和收藏均复用项目既有图标库，尺寸与描边一致，并配有可访问名称。
- 响应式：700 × 900 复验中抽屉占满视口、文档无横向溢出；缩略图变为 4 列，双图改为单列滚动，底部操作改为三行，仍可完成核心流程。
- 可访问性：抽屉、对比区、导航和输入均有语义标签；所有关键动作为原生按钮，采用前保存按钮具有真实 disabled 状态，输入支持 Enter 触发重新生成。

### Primary interaction verification

- 打开模板选择 → 自定义套图 → 第 4 张 Logo 工艺展示：通过。
- 自然语言输入、重新生成和“再生成一个”均可操作；浏览器实测候选图片 URL 从 `cap-logo-crafts.jpg` 切换到 `cap-detail-callouts.jpg`：通过。
- 采用候选图后显示 AI 特征提取成功状态，并启用“保存为我的模板”：通过。
- 保存后按钮切换为“已保存到我的模板”；返回整套后该槽位显示“已采用 AI 新版本”：通过。
- 浏览器 console error / warning：0。
- 自动化测试：48 / 48 通过；TypeScript 检查与 Vite Production 构建通过。

### Findings and comparison history

1. [P2 已修复] 首轮实现只有返回箭头，没有显示源稿中的“返回整套”文字，降低了大抽屉中的导航确定性；已补充可见文字并在 `custom-slot-editor-v2.png` 复验。
2. 第二轮未发现遗留 P0 / P1 / P2 问题。
3. [P3] 700px 窄屏的六张缩略图分为两行，信息密度高于桌面；核心操作仍完整可用，可在未来移动端专稿中进一步收紧缩略图高度。

final result: passed

---

## 2026-07-20 套图与详情图自定义模板验收

- source visual truth:
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/detail-b2b-eight-template-library.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/detail-b2b-eight-procurement-roles.png`
- browser-rendered implementation screenshots:
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/custom-template-set-library.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/custom-template-set-builder.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/custom-template-listing-library.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/custom-template-listing-builder.png`
- combined comparison evidence:
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/custom-template-listing-comparison.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/custom-template-listing-builder-comparison.png`
- route: `http://127.0.0.1:5174/PTJ_Prototype/#/generation`
- viewport: 1094 × 920
- state: 批量生图 / 套图与详情图 / 自定义模板卡片 / 职责替换、排序与提交

### Full-view comparison evidence

- 已把修改前的详情图模板库与修改后的浏览器截图水平合并检查。新增“自定义”分类和“自定义详情图”卡片后，抽屉仍保持原来的两列网格、暖白底、橙色选中态、细边框、圆角、卡片高度和底部固定主按钮；没有新增页面或破坏原有三套预设。
- 自定义卡片使用现有真实模板缩略图组成四宫格，未使用占位框、CSS 图形或无关素材；虚线边框与深色职责组合图标让入口醒目，但视觉权重不超过当前选中模板。
- 套图模板库同步提供“自定义套图”，与四套现有套图并列；详情图模板库只展示三套 B2B 详情预设与一个自定义入口，类型没有串库。
- 浏览器实测页面 `scrollWidth=1094`、`clientWidth=1094`，主页面与抽屉均无横向溢出。

### Focused region comparison evidence

- 已把现有“采购决策详情”的逐图详情页与新的“自定义详情图”编排器水平合并检查。两者沿用相同抽屉宽度、顶栏高度、返回/关闭按钮、橙色主按钮和两列图片卡片密度。
- 编排器顶部先展示 6/6 或 8/8 完整度和生成顺序；已选职责卡保留真实缩略图、两位序号、标题、来源、上移、下移和删除，避免只靠文字列表导致顺序难以确认。
- 下方职责库按来源预设分组，套图为 24 个可选职责，详情图为 24 个可选职责；满额时替代项降灰，移除一项后恢复可选，选择后的橙色边框和序号与现有模板选中态一致。

### Required fidelity surfaces

- 字体与排版：标题 18px、区块标题 10–12px、辅助文案 7–9px，复用现有紧凑抽屉层级；长构图说明使用两行截断，未挤压操作按钮。
- 间距与布局节奏：选中顺序和职责库均为两列，卡片内图片、序号、文字和操作区对齐；底部提交按钮保持固定，不因职责库过长而滚出视口。
- 颜色与视觉令牌：继续使用项目橙色、暖白、浅棕边框和绿色完成状态；未引入新的蓝紫主色或独立阴影系统。
- 图片质量与资产保真：所有职责沿用现有模板登记的真实商品、场景、工厂、质检和包装素材，缩略图裁切清晰，没有拉伸、透明光晕或占位图。
- 文案与内容：明确“只能选择当前类型”“顺序就是最终图片顺序”和固定 6/8 张；没有把自定义能力描述成任意 Prompt 编辑器。

### Primary interaction verification

- 套图：从标准商品套图预填 6 项，移除“商品主视觉”，加入企业实力模板的“企业总览”，上移后提交；摘要成功变为“自定义套图 · 6 张 / 版”。
- 详情图：从采购决策详情预填 8 项，职责库只包含采购决策、OEM/ODM 和工厂履约三套详情模板；移除“产品介绍”，加入 OEM/ODM 的“Logo 与表面工艺”后提交；摘要成功变为“自定义详情图 · 8 张 / 版”。
- 固定数量、满额禁用、移除后恢复选择、上移/下移边界禁用、抽屉返回与关闭均通过。
- 浏览器无 React、TypeScript 或运行时错误；仅保留本地 FastAPI 未启动时既有的 Capabilities 静态快照降级警告，不影响本次交互，也不是本次改动回归。

### Automated verification

- 前端自动化测试：48 / 48 通过。
- 后端自动化测试：52 / 52 通过。
- TypeScript 检查与 Vite Production 构建：通过。

### Findings and comparison history

- 首次实现检查未发现可执行的 P0 / P1 / P2 视觉或核心交互问题，因此无需修复后重拍第二轮。
- P3 后续可选：在职责数量继续增长时增加按职责关键词搜索；当前套图与详情图各 24 项，分组浏览已足够，不阻塞本次交付。

final result: passed

---

## 2026-07-20 B2B 详情图八张结构与真实预览验收

- source visual truth:
  - `/var/folders/94/2dlbsm3968j4rqjll_d32qb40000gn/T/codex-clipboard-0f2d0cb3-47ce-4287-b8df-30017aec2ce4.png`
  - `/var/folders/94/2dlbsm3968j4rqjll_d32qb40000gn/T/codex-clipboard-87d2708e-2696-4036-8af7-191849b05231.png`
- previous UI baseline:
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/01-b2b-detail-template-current.png`
- implementation screenshots:
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/detail-b2b-eight-template-library.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/detail-b2b-eight-procurement-roles.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/detail-b2b-eight-procurement-lightbox.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/detail-b2b-eight-oem-roles.png`
  - `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/detail-b2b-eight-fulfillment-roles.png`
- route: `http://127.0.0.1:5174/PTJ_Prototype/#/generation`
- state: 批量生图 / 详情图 / 三套模板库 / 逐张画面结构 / 大图预览

### Full-view comparison evidence

- 用户参考长图包含产品总览、产品矩阵、卖点、规格、材质、场景、定制、MOQ、工厂、质检、认证、包装、物流、合作流程和 FAQ 等十余个采购模块；压缩为 5 张会导致单张同时承担多个决策问题，信息密度和可读性均不足。
- 用户确认 8 张已经足够。实现把需要 SKU、规格、MOQ、产能、证书数值的高交互模块合并或改写为产品介绍、结构使用、品质控制与合作流程，使用户仅凭商品图和少量补充文字即可生成。
- 实现延续批图匠现有橙色、暖白、细边框和紧凑桌面抽屉，不把模板详情改造成独立页面；模板库直接标明“8 张详情图”，降低误选成本。
- 三套模板各使用 8 张独立 ImageGen 原创商业摄影，共 24 张；预览图不含可读品牌、认证、规格数字或水印，避免将未知事实伪装成真实素材。

### Template and interaction verification

- 采购决策详情：产品总览、产品介绍、采购价值、结构使用、材质工艺、应用场景、品质控制、包装合作，共 8 张；旧的“产品矩阵与型号”和“关键规格参数”已确认不再出现。
- OEM/ODM 定制详情：定制总览、产品开发、材质颜色、结构配件、Logo 工艺、包装说明、打样量产、品质交付，共 8 张。
- 工厂履约详情：工厂团队、产线工艺、来料检验、过程品控、成品检验、检测能力、仓储装柜、项目履约，共 8 张。
- 三套模板详情均实际渲染 8 张逐图卡片；每张包含独立真实图片、两位序号、职责标题和构图说明。浏览器实测三套图片 URL 均指向各自的 8 张专属素材。
- 点击任一图片可打开大图弹窗；实测 `01 / 8` 可切换到 `02 / 8`，职责标题与构图说明同步变化，关闭后保持模板详情位置。
- 详情图入口、每版摘要、总数和主按钮均同步为 8 张；后端 `listing_01`、三套视觉模板、Planner 角色绑定和最大 80 张单任务上限保持一致。

### Visual findings

- 模板库三张卡片在当前视口无横向溢出；详情页使用两列卡片提升浏览效率，较长职责和构图说明均可完整换行。
- 大图预览使用居中单图、清晰序号和前后导航；不在缩略图阶段塞入大段文字，用户仍能逐张看到足够的信息结构。
- 模板库在 1094px 视口下 `scrollWidth` 与 `clientWidth` 均为 1094px，无横向溢出。
- 参考图与实现截图已在同一次视觉检查中并列查看；三套真实图片均逐张检查，无遗留 P0 / P1 / P2 视觉或核心交互问题。

### Automated verification

- 前端自动化测试：46 / 46 通过。
- 后端自动化测试：48 / 48 通过。
- TypeScript 检查、Vite Production 构建、lint 与 `git diff --check`：通过。

final result: passed

---

## 2026-07-19 主图双图片输入验收

- source visual truth: `/var/folders/94/2dlbsm3968j4rqjll_d32qb40000gn/T/codex-clipboard-4a4a5273-0bb6-4bba-a0d3-7a2520e9ab80.png`
- mismatch baseline: `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/main-dual-image-input-final-connected.png`
- implementation screenshot: `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/main-matched-upload-cards.png`
- uploaded-state screenshot: `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/main-dual-image-input-uploaded.png`
- route: `http://127.0.0.1:5173/PTJ_Prototype/#/generation`
- viewport: 1094 × 920
- state: 批量生图 / 主图 / PTJ-1 / 1:1 / 参考设计图与产品素材图空态及已上传态

### Full-view comparison evidence

- 已在同一次视觉检查中并列打开用户参考截图与实现截图；实现沿用参考稿“参考设计图在上、产品素材图在下”的信息顺序，并保持批图匠现有橙色、暖白、细边框和紧凑表单设计系统。
- 最新标注要求两组图片区保持一致；已在同一次对照中并列检查修改前后截图。两张空态卡片现在使用同一组件骨架，浏览器实测宽度均为 334.7px、高度均为 146px，边框均为 1px、圆角均为 11px。
- 参考截图是独立移动端卡片示意；实现将其压缩进现有桌面左栏，没有照搬过大的留白和字号。1094px 宽视口下文档 `scrollWidth` 与 `clientWidth` 均为 1094px，无横向滚动。
- 套图仍保留“生图模板”；切换主图后模板区完全移除，双图片输入直接衔接四类图片标签，避免把套图模板误用到主图。

### Focused region comparison evidence

- 上方“参考设计图”最多 1 张，空态支持拖拽与点击；上传后显示真实缩略图、文件名、用途说明和移除按钮，点击缩略图可打开大图预览。
- 下方“产品素材图”最多 6 张，采用和参考设计图相同的标题、计数、虚线上传区、边框与留白；支持点击、粘贴和拖拽，上传后显示独立缩略图，不与设计参考图混合计数。
- 文字输入已从第二张图片卡片中拆出，成为独立的 500 字“补充要求（选填）”紧凑面板，只补充背景、场景、文案或必须保留细节。

### Required fidelity surfaces

- 字体与排版：标题、辅助文案、计数和按钮字号均复用现有表单层级；参考稿的两级标题关系被保留，但没有造成局部字号放大。
- 间距与布局节奏：双图片区使用完全相同的 146px 卡片高度和 12px 间距；补充文字独立成块，真实生图参数仍位于同屏下方。
- 颜色与视觉令牌：继续使用项目橙色主色、暖白背景、浅灰虚线与 12px 圆角；未引入新的蓝紫色或独立组件风格。
- 图片质量与素材保真：浏览器使用项目内真实 JPEG 分别上传到两组输入，缩略图比例正确；预览弹窗显示原图，无占位图或 CSS 图形替代。
- 文案与内容：明确“参考设计图”只参考构图/风格，“产品素材图”决定商品主体；避免使用鼓励复制品牌、文字或受保护元素的表述。

### Findings and fixes

1. [P2 已修复] 套图视觉模板原本在四种图片类型中共用，主图容易被误解为也受套图结构控制；现仅在套图显示。
2. [P2 已修复] 单一商品参考图输入无法区分竞品风格图和自有产品图；现拆为独立请求字段，并在后端隔离商品分析。
3. [P2 已修复] 参考稿原始卡片留白较大，直接照搬会挤出参数区；实现保留层级与操作但按现有左栏密度压缩。
4. [P2 已修复] 首版把产品上传与文字输入合在一个面板，导致两组图片卡片外观和高度不一致；现改用同一骨架，并把文字说明独立下移。
5. 无遗留 P0 / P1 / P2 问题。

### Interaction verification

- 主图 / 套图切换与模板显隐：通过。
- 参考设计图单张上传、缩略图、大图预览、关闭与移除入口：通过。
- 产品素材图多张上传、缩略图、粘贴/拖拽代码路径与移除入口：通过。
- 两组图片独立计数（1/1 与 1/6）：通过。
- 两张空态上传卡片同宽、同高、同边框和同圆角：通过。
- 产品卡片内紧凑 Logo 入口打开与关闭：通过。
- 本地 FastAPI Capabilities 联通后复验：通过；复验阶段没有新增浏览器 error 或 warning。
- 1094 × 920 横向溢出检查：通过。
- 前端自动化测试 45 项、后端自动化测试 46 项：通过。
- TypeScript 检查、Vite Production 构建与 `git diff --check`：通过。

final result: passed

---

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

## 2026-07-18 紧凑 Logo 入口验收

- source visual truth: `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/logo-before-d5f4789.png`
- implementation screenshot: `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/logo-compact-final.png`
- combined comparison: `/Users/garden/.codex/visualizations/2026/07/17/019f7076-f189-7d02-a4bf-5e8318256d23/logo-before-after-comparison.png`
- route: `http://127.0.0.1:5173/PTJ_Prototype/#/generation`
- viewport: 1280 × 720
- state: 批量生图 / 套图 / Logo 浮层展开 / 已上传测试图 / 右上角

### Full-view comparison evidence

- 改动前后使用相同 1280 × 720 视口；顶部导航、左侧业务导航、表单宽度、模板区、商品图输入区和真实生图参数保持原布局。
- 新入口位于“商品参考图”标题行右侧，以小尺寸橙色描边按钮显示；Logo 设置使用锚定浮层覆盖输入区，不新增常驻高度，也不推动下方表单。
- 右侧结果区内容来自两个端口各自的本地历史数据，因此结果图片状态不同；本次对照范围聚焦未变的左侧表单与新增 Logo 交互。

### Focused region comparison evidence

- 标题行新增“添加 Logo”按钮；上传后按钮显示缩略图和“Logo 已添加”，仍保持单行高度。
- 浮层宽度约 292px，包含 Logo 预览、文件名、大小、移除按钮和位置下拉框；在表单列内完整显示，无裁切、遮挡标题或横向溢出。
- Logo 图片与商品参考图维持独立语义，不进入商品主体分析；仅作为最后一张品牌参考图传入生图请求。

### Required fidelity surfaces

- 字体与排版：沿用现有字号、字重和辅助文案层级，新增控件未出现局部放大或不一致的标签尺寸。
- 间距与布局节奏：入口占用标题行剩余空间；浮层采用现有 12px 圆角、细边框和轻阴影，不增加页面纵向长度。
- 颜色与视觉令牌：继续使用项目橙色主色、暖白背景和浅灰边框；选中态与已有按钮、标签一致。
- 图片质量与素材保真：上传后展示真实缩略图；点击可打开大图预览，未使用占位资产或 CSS 图形替代。
- 文案与内容：明确“品牌 Logo”“上传 1 张”“显示位置”“安全边距”，避免把 Logo 误解为商品参考图。

### Findings and fixes

1. [P2 已修复] 初次检查时仅上传 Logo 的页面底部仍显示通用参考图说明；已改为“Logo 会作为独立品牌参考传入，不会被当成商品主体”。
2. [P2 已修复] 初次上传后紧凑按钮的可访问名称包含图片 alt；已将装饰缩略图从可访问名称中移除，按钮稳定显示“Logo 已添加”。
3. 无遗留 P0 / P1 / P2 问题。

### Interaction verification

- 打开 / 关闭 Logo 设置浮层：通过。
- 上传 Logo、显示缩略图和文件信息：通过。
- 位置从默认右下角切换到右上角：通过。
- 点击缩略图打开大图预览并关闭：通过。
- 移除 Logo 后恢复上传空态，再次上传：通过。
- 浏览器控制台：无 error。
- 前端自动化测试：42 项通过。
- 后端自动化测试：44 项通过。
- ESLint、TypeScript 与 Vite 生产构建：通过。

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
