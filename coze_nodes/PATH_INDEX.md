# Coze 可复用工作流路径索引

本文档把节点整理成“路径”。后续测试、说明或补充已创建工作流时，可以从这里理解节点组合方式，再按具体业务补字段、Prompt 和输出结构。

## 使用原则

- 原始节点没有连线，本文档里的路径是基于节点能力整理出的可复用组合。
- 这些路径主要用于理解和复用“生成生图 Prompt”工作流相关节点，不代表已经可运行。
- 工作流方案可以参考这些路径，但真实 `workflow_id`、接口调用、实测 Output Schema 仍要登记到根目录 `WORKFLOWS.md`。
- 图片类工作流默认需要考虑：图片数量限制、单图大小、失败重试、结果 URL 汇总、是否异步返回。

## P-001 文生图 Prompt 到图片

适用场景：批量文生图、商品主图、套图、详情图、海报。

路径：

```text
开始(input)
-> 大模型(拆解商品、卖点、图片角色，输出结构化 Prompt)
-> sd_better_prompt(优化单张或多张图片 Prompt，可选)
-> 图像生成(按 Prompt 生成图片)
-> 结束(output)
```

建议输入字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `product_name` | string | 商品名称。 |
| `selling_points` | string/list | 商品卖点。 |
| `image_type` | string | 主图、套图、详情图、海报。 |
| `aspect_ratio` | string | 图片比例，例如 1:1。 |
| `count` | number | 生成数量。 |
| `logo_text` | string | 可选，Logo 或品牌文字。 |

建议输出字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `image_prompts` | array | 每张图的 Prompt、负面 Prompt、图片角色。 |
| `images` | array | 生成图片 URL 或 Coze 图片对象。 |
| `summary` | string | 本次生成摘要。 |

## P-002 图生图优化

适用场景：上传原图后，保留商品主体，重新生成电商主图、套图、详情图或海报。

路径：

```text
开始(input + image_urls)
-> 大模型(理解用户指令，生成图生图 Prompt)
-> sd_better_prompt(优化 Prompt，可选)
-> 图像生成(references 使用上传图片)
-> 结束(output)
```

关键点：

- `references` 应接上传图片 URL。
- Prompt 里必须说明“保留商品主体、颜色、关键结构”，避免模型过度改商品。
- 如果用户要求不改变尺寸，应在 Prompt 和图像生成设置里同时约束比例。

## P-003 批量抠图

适用场景：批量 AI 修图里的“抠图”，输出透明背景商品图。

路径：

```text
开始(image_urls + prompt)
-> 批处理(逐张处理 image_urls)
-> cutout(url, prompt, output_mode=0, only_mask=0)
-> 变量聚合(汇总每张图结果)
-> 结束(output)
```

建议输入字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `image_urls` | array<string> | 待抠图图片 URL 列表。 |
| `prompt` | string | 抠图提示词；不填时可默认“保留商品主体”。 |
| `keep_original_size` | boolean | 是否保留原图尺寸。映射到 `only_mask=3`。 |

建议输出字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `results[].source_url` | string | 原图 URL。 |
| `results[].cutout_url` | string | 透明背景图 URL。 |
| `results[].mask` | string | 蒙版数据，按需返回。 |
| `failed_items` | array | 失败图片和原因。 |

## P-004 批量画质提升

适用场景：上传图片后批量提升清晰度。

路径：

```text
开始(image_urls)
-> 批处理(逐张处理 image_urls)
-> image_quality_improve(image_url)
-> 变量聚合(汇总增强图)
-> 结束(output)
```

关键点：

- 适合放在抠图、图生图或画板排版之后作为增强步骤。
- 如果图片很多，建议用异步任务路径，避免接口调用超时。

## P-005 图像生成后画板排版

适用场景：生成图片后添加文字、Logo、统一排版，做详情图或海报。

路径：

```text
开始(input)
-> 大模型(生成文案和排版结构)
-> 图像生成(生成背景或商品图)
-> 画板(canvasSchema 排版文字、Logo、图片)
-> 结束(output)
```

关键点：

- 画板节点适合做最终视觉排版，但需要明确画布尺寸、文字内容、Logo 位置和图片 URL。
- 如果只是生成图片，不需要排版，可以跳过画板。

## P-006 意图识别分流

适用场景：用户只说自然语言需求，系统自动判断走文生图、图生图、抠图或画质提升。

路径：

```text
开始(query + optional image_urls)
-> 意图识别(输出 classificationId)
-> 选择器(按 classificationId 分支)
-> 分支 A: 文生图路径 P-001
-> 分支 B: 图生图路径 P-002
-> 分支 C: 抠图路径 P-003
-> 分支 D: 画质提升路径 P-004
-> 变量聚合
-> 结束(output)
```

关键点：

- 使用前必须配置意图列表。
- 如果用户需求明确，不必强行加意图识别，直接走对应路径更简单。

## P-007 知识库增强商品 Prompt

适用场景：有品牌规范、商品资料、行业资料时，根据知识库内容生成更准确的图片 Prompt。

路径：

```text
开始(product_name + query)
-> 知识库检索(topK=5)
-> 大模型(结合知识库结果生成 Prompt)
-> sd_better_prompt(可选)
-> 图像生成
-> 结束(output)
```

关键点：

- 当前节点素材未绑定具体知识库。
- 只有当用户明确提供知识库或资料来源时才使用，不要默认编造资料。

## P-008 异步批量图片任务

适用场景：图片数量多、耗时长，需要返回任务 ID，而不是同步等所有图片完成。

路径：

```text
开始(task_payload)
-> 异步任务(创建任务实例)
-> 输出(taskId + msg)
-> 结束(output)
```

关键点：

- 适合大批量图生图、批量抠图、批量画质提升。
- 需要另配“查询任务状态/取结果”的工作流或接口，否则调用方只能拿到 `taskId`。
