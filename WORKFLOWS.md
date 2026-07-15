# 批图匠 Coze 工作流登记册

本文档用于统一记录批图匠项目里已经创建好的 Coze 工作流，当前重点是“生成生图 Prompt”的工作流。

这里的“生成生图 Prompt”不是直接出最终图片，而是根据商品、卖点或图片生成需求，输出可交给图片生成模型使用的正向 Prompt、负面 Prompt、图片角色、可见文案、画面策略等结构化内容。

本文档方便后续把工作流同步给开发同事，也方便自己在 Coze 或 ChatGPT 网页端继续维护、测试、复用和排查。

## 维护规则

- 所有项目相关 Coze 工作流都集中登记在本文档。
- 当前优先登记已经创建好的生图 Prompt 生成工作流；未连线的节点素材只作为参考，不等于可运行工作流。
- Coze Bearer Token、API Key 等敏感信息不写明文，只记录环境变量名，例如 `${COZE_API_TOKEN}`。
- 调用示例必须使用环境变量占位，不能硬编码真实凭证。
- Input Schema 记录实际入参字段、类型、是否必填、示例值和说明。
- Output Schema 以实际调用结果为准；未实测前必须标记为“待确认”，不要凭空猜测。
- 如果用户提供调用函数、Input Schema、Output Schema，并要求生成说明图，应使用 ImageGen 工具生成一张配套说明图，帮助开发同事快速理解调用方式和数据流。
- 配套说明图需要和对应工作流绑定记录，包含图片用途、生成状态、图片文件路径或交付位置、生成依据和注意事项。
- 每次新增、修改或补充实测结果，都要在对应工作流的 Changelog 中记录。
- 如果后续工作流数量过多，单文件难以维护，再拆分为 `workflows/` 目录；拆分前仍以本文档为主索引。

## 工作流索引

| 编号 | 页面/功能 | 工作流名称 | workflow_id | 状态 | 最后更新 |
|---|---|---|---|---|---|
| WF-001 | 批量文生图 / 套图 | `ptj_TextToPicture_Set` | `7641856728498454566` | 已实测，Output Schema 已记录；2026-06-29 空参也可返回默认 Prompt | 2026-06-29 |
| WF-002 | 批量文生图 / 详情图 | `ptj_TextToPicture_Listing` | `7646263856126197803` | 已实测，空参返回空 Prompt 结构；名称按输出字段推定 | 2026-06-29 |
| WF-003 | 图生图 / 详情图 | `ptj_PicToPic_Listing` | `7656348082263212066` | 已实测，HTTP 成功但业务输出为 `image_input:null`，需排查入参映射 | 2026-06-29 |
| WF-004 | 图生图 / 套图 | `ptj_PicToPic_Set` | `7656403827810025510` | 已实测，返回 `image_input` Prompt 结构 | 2026-06-29 |
| WF-005 | 文生图 / 海报 | `ptj_TextToPic_Poster` | `7656641215886852146` | 已实测，返回海报 Prompt 结构 | 2026-06-29 |
| WF-006 | 图生图 / 海报 | `ptj_PicToPic_Poster` | `7656654649588727871` | 已实测，返回 `image_input` Poster Prompt 结构 | 2026-06-29 |

## WF-001 `ptj_TextToPicture_Set`

### 基础信息

- 页面/功能：批量文生图 / 套图
- 工作流名称：`ptj_TextToPicture_Set`
- 中文名称：批图匠文生图套图
- 业务用途：根据用户输入的商品或卖点文本，调用 Coze 工作流生成可用于图片生成模型的套图 Prompt、负面 Prompt、图片角色、可见文案和视觉策略。
- Coze 接口：`https://api.coze.cn/v1/workflow/stream_run`
- 请求方式：`POST`
- workflow_id：`7641856728498454566`
- 鉴权变量：`${COZE_API_TOKEN}`
- 请求头：`Content-Type: application/json`
- 状态：已实测调用方式，Output Schema 已按 2026-05-25 实际返回补齐。

### Input Schema

| 字段路径 | 类型 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|---|
| `workflow_id` | string | 是 | `7641856728498454566` | Coze 工作流 ID，用于指定要运行的工作流。 |
| `parameters.user_input` | string | 是 | `衣服` | 用户输入的商品、品类或卖点文本。当前已知示例为“衣服”。 |

### Output Schema

当前状态：已确认。

说明：

- 该接口返回的是 SSE 流式事件。
- `event: Message` 中的 `data` 是 JSON 对象。
- `data.content` 仍然是一段 JSON 字符串，需要二次解析后才能拿到业务输出。
- `event: Done` 中返回 `debug_url`，用于进入 Coze 查看本次执行调试信息。
- 字段名 `product_name_origina` 是实际返回字段，疑似少了最后的 `l`，下游解析时不要擅自改成 `product_name_original`，除非工作流输出字段已同步修正。

流式事件字段：

| 字段路径 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| `event` | string | `Message` | Coze 流式事件类型。业务结果在 `Message` 事件中返回。 |
| `id` | number | `0` | SSE 事件序号。 |
| `data.node_title` | string | `End` | 返回结果所在节点标题。 |
| `data.node_type` | string | `End` | 返回结果所在节点类型。 |
| `data.content_type` | string | `text` | 内容类型。当前返回文本，但文本内容本身是 JSON 字符串。 |
| `data.content` | string | `{"output": {...}}` | 业务输出 JSON 字符串，需要二次解析。 |
| `data.usage.input_count` | number | `3987` | 本次执行输入 token 数。 |
| `data.usage.output_count` | number | `1767` | 本次执行输出 token 数。 |
| `data.usage.token_count` | number | `5754` | 本次执行 token 总数。 |
| `data.node_is_finish` | boolean | `true` | 当前节点是否执行完成。 |
| `Done.data.debug_url` | string | `https://www.coze.cn/work_flow?...` | Coze 调试页面链接。 |

业务输出字段：

| 字段路径 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| `output.image_prompts` | array<object> | 6 个对象 | 生成图片 Prompt 数组。当前输入“衣服”返回 6 张图的 Prompt。 |
| `output.image_prompts[].id` | number | `1` | 单张图 Prompt 编号。 |
| `output.image_prompts[].image_role` | string | `Hero Selling Image` | 单张图在套图中的角色。 |
| `output.image_prompts[].business_goal` | string | `展示服装核心价值，吸引潜在买家` | 该图承担的业务目标。 |
| `output.image_prompts[].prompt` | string | `Square 1:1 image...` | 可交给图片生成模型使用的英文正向 Prompt。 |
| `output.image_prompts[].negative_prompt` | string | `fake brand logo, watermark...` | 负面 Prompt，用于限制水印、假品牌、低清晰度等问题。 |
| `output.image_prompts[].visible_text` | array<string> | `["Wholesale Clothing", "Factory Direct"]` | 建议出现在图片上的可见文案。 |
| `output.image_prompts[].aspect_ratio` | string | `1:1` | 图片比例。 |
| `output.industry_type` | string | `服装配饰类` | 工作流识别出的行业类型。 |
| `output.product_name_english` | string | `Clothing` | 英文产品名。 |
| `output.product_name_origina` | string | 空字符串 | 原始产品名字段。注意实际字段名缺少最后的 `l`。 |
| `output.search_insights` | array<string> | 5 条洞察 | 工作流生成的搜索/市场洞察摘要。 |
| `output.visual_strategy` | string | `突出服装系列化...` | 整体视觉策略说明。 |

本次返回的 6 个图片角色：

| id | image_role | visible_text 摘要 |
|---|---|---|
| 1 | `Hero Selling Image` | `Wholesale Clothing`、`Factory Direct`、`Custom Sizing`、`Multiple Styles` |
| 2 | `Core Benefits Image` | `Durable Fabric`、`Custom Logo`、`Bulk Production`、`Fast Delivery` |
| 3 | `Product Details Image` | `Double Stitched`、`Reinforced Seams`、`Premium Buttons`、`Breathable Fabric` |
| 4 | `Application Scenario Image` | `Corporate Uniform`、`Outdoor Activity`、`Casual Wear`、`Formal Business` |
| 5 | `Industry Differentiation Image` | `OEM/ODM Available`、`Fabric Selection`、`Design Service`、`Factory Inspection` |
| 6 | `Conversion Image` | `MOQ Flexible`、`Fast Delivery`、`Quality Guarantee`、`Contact Supplier` |

### 配套说明图

当前状态：未生成。

用途：

- 后续当用户提供该工作流的调用函数、Input Schema 和 Output Schema 后，可按需生成一张说明图。
- 说明图用于和调用函数一起发给开发同事，帮助对方快速理解接口调用、入参、出参和数据流。

生成要求：

- 使用 ImageGen 工具生成图片。
- 图片内容应围绕当前工作流，不要混入其他未确认工作流。
- 图片应尽量包含：工作流名称、调用入口、核心 input、核心 output、调用顺序、注意事项。
- 不要在图片中展示明文 token、API Key 或其他敏感信息，只能使用 `${COZE_API_TOKEN}` 这类变量名。

记录字段：

| 字段 | 当前值 |
|---|---|
| 图片状态 | 未生成 |
| 图片路径或交付位置 | 待生成后补充 |
| 生成依据 | 已有调用接口、Input Schema 和 Output Schema；如需说明图，可基于 2026-05-25 实测结果生成。 |
| 注意事项 | 不展示明文密钥；Output Schema 以实测或用户提供内容为准。 |

### 调用示例

```bash
curl -X POST 'https://api.coze.cn/v1/workflow/stream_run' \
  -H "Authorization: Bearer ${COZE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "7641856728498454566",
    "parameters": {
      "user_input": "衣服"
    }
  }'
```

### 实测记录

#### 2026-05-25 实测

- 测试输入：`parameters.user_input = "衣服"`。
- 是否成功：成功。
- 接口返回：`event: Message` + `event: Done`。
- 返回摘要：业务输出包含 `image_prompts` 6 条、`industry_type`、`product_name_english`、`product_name_origina`、`search_insights` 5 条、`visual_strategy`。
- Output Schema 变更：从“待确认”更新为已确认，并补充 SSE 事件字段、二次解析规则和业务输出字段。
- 异常信息：无接口异常；需注意 `product_name_origina` 是实际返回字段名，疑似拼写不完整。

#### 2026-06-29 空参复测

- 测试输入：`parameters = {}`。
- 是否成功：成功。
- 接口返回：`event: Message` + `event: Done`。
- 返回摘要：业务输出仍包含 `image_prompts`、`industry_type`、`product_name_english`、`product_name_origina`、`search_insights`、`visual_strategy`。
- 实测现象：即使未传 `user_input`，也会返回一组默认商品 Prompt；本次样例偏向智能手表。
- 注意事项：调用方如果希望稳定按指定商品生成，仍应传入业务输入字段，不建议依赖空参默认结果。

### Changelog

| 日期 | 变更内容 | 原因 |
|---|---|---|
| 2026-06-29 | 按截图命名规则更新为 `ptj_TextToPicture_Set`。 | 用户补充 Coze 工作流名称截图，需要让登记册名称和 Coze 后台一致。 |
| 2026-06-29 | 复测空参调用，记录空参也能返回默认 Prompt 的现象。 | 用户补充多条已创建工作流 curl，需要统一登记和测试。 |
| 2026-05-25 | 实测 WF-001，补充流式返回结构、业务 Output Schema、图片角色摘要和字段名注意事项。 | 用户提供实际 `stream_run` 调用，需要验证并把真实返回结构登记下来。 |
| 2026-05-22 | 新增 WF-001 文生图套图工作流登记，记录接口、workflow_id、input schema 和安全调用示例。 | 建立统一工作流登记册，方便后续同步给开发同事和持续维护。 |

## WF-002 `ptj_TextToPicture_Listing`

### 基础信息

- 页面/功能：批量文生图 / 详情图
- 工作流名称：`ptj_TextToPicture_Listing`
- 中文名称：批图匠文生图详情图
- 业务用途：根据产品和卖点生成详情图生图 Prompt；本次只测试到空参数返回结构。
- Coze 接口：`https://api.coze.cn/v1/workflow/stream_run`
- 请求方式：`POST`
- workflow_id：`7646263856126197803`
- 鉴权变量：`${COZE_API_TOKEN}`
- 状态：已实测，HTTP 成功，但空参只返回空业务结构；名称按 `listing_strategy` 等输出字段和截图命名推定。

### Input Schema

| 字段路径 | 类型 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|---|
| `workflow_id` | string | 是 | `7646263856126197803` | Coze 工作流 ID。 |
| `parameters` | object | 是 | `{}` | 本次用户提供调用为空参数。 |

### Output Schema

当前状态：已确认空参返回结构。

| 字段路径 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| `output.aspect_ratio` | string | 空字符串 | 图片比例；空参时未生成有效值。 |
| `output.image_prompts` | array | `[]` | 生图 Prompt 数组；空参时为空数组。 |
| `output.industry_type` | string | 空字符串 | 行业类型；空参时为空。 |
| `output.listing_strategy` | string | 空字符串 | 商品图策略；空参时为空。 |
| `output.product_name_english` | string | 空字符串 | 英文商品名；空参时为空。 |
| `output.product_name_origina` | string | 空字符串 | 原始商品名字段；保留实际字段名。 |
| `output.search_insights` | array | `[]` | 搜索洞察；空参时为空数组。 |

### 调用示例

```bash
curl -X POST 'https://api.coze.cn/v1/workflow/stream_run' \
  -H "Authorization: Bearer ${COZE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "7646263856126197803",
    "parameters": {}
  }'
```

### 实测记录

#### 2026-06-29 实测

- 测试输入：`parameters = {}`。
- 是否成功：成功。
- 接口返回：`event: Message` + `event: Done`。
- token 用量：`input_count=3132`、`output_count=73`、`token_count=3205`。
- 返回摘要：业务输出包含 `aspect_ratio`、`image_prompts`、`industry_type`、`listing_strategy`、`product_name_english`、`product_name_origina`、`search_insights`，但值为空。
- 结论：接口可调用，但需要补充有效入参后才能作为生图 Prompt 工作流使用。
- 名称判断：输出字段包含 `listing_strategy`，结合截图中的 `ptj_TextToPicture_Listing`，推定该工作流为文生图详情图 Prompt 工作流。

### Changelog

| 日期 | 变更内容 | 原因 |
|---|---|---|
| 2026-06-29 | 按截图命名规则更新为 `ptj_TextToPicture_Listing`。 | 用户补充 Coze 工作流名称截图，需要让登记册名称和 Coze 后台一致。 |
| 2026-06-29 | 新增 WF-002 登记和空参实测记录。 | 用户提供已创建工作流调用，需要保存和测试。 |

## WF-003 `ptj_PicToPic_Listing`

### 基础信息

- 页面/功能：图生图 / 多图输入
- 工作流名称：`ptj_PicToPic_Listing`
- 中文名称：批图匠图生图详情图
- 业务用途：根据多张参考图和文本需求生成图生图详情图 Prompt。
- Coze 接口：`https://api.coze.cn/v1/workflow/stream_run`
- 请求方式：`POST`
- workflow_id：`7656348082263212066`
- 鉴权变量：`${COZE_API_TOKEN}`
- 状态：已实测，HTTP 成功，但业务输出为 `image_input:null`，需要排查工作流入参映射。

### Input Schema

| 字段路径 | 类型 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|---|
| `workflow_id` | string | 是 | `7656348082263212066` | Coze 工作流 ID。 |
| `parameters.image_1` 到 `parameters.image_10` | string | 是 | 用户提供的 Coze 临时图片 URL | 多张参考图。本次提供 10 张图片。 |
| `parameters.text_input` | string | 是 | `1:1，猫碗` | 用户的图片比例和商品需求。 |

### Output Schema

当前状态：已确认本次异常输出。

| 字段路径 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| `output.image_input` | null | `null` | 本次返回为空，说明工作流可能未正确读取图片或文本入参。 |

### 调用示例

```bash
curl -X POST 'https://api.coze.cn/v1/workflow/stream_run' \
  -H "Authorization: Bearer ${COZE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "7656348082263212066",
    "parameters": {
      "image_1": "<Coze image URL>",
      "image_2": "<Coze image URL>",
      "image_3": "<Coze image URL>",
      "image_4": "<Coze image URL>",
      "image_5": "<Coze image URL>",
      "image_6": "<Coze image URL>",
      "image_7": "<Coze image URL>",
      "image_8": "<Coze image URL>",
      "image_9": "<Coze image URL>",
      "image_10": "<Coze image URL>",
      "text_input": "1:1，猫碗"
    }
  }'
```

### 实测记录

#### 2026-06-29 实测

- 测试输入：10 张图片 URL + `text_input = "1:1，猫碗"`。
- 是否成功：HTTP 成功。
- 接口返回：`event: Message` + `event: Done`。
- token 用量：`input_count=16620`、`output_count=2441`、`token_count=19061`。
- 返回摘要：业务输出为 `{"image_input": null}`。
- 异常信息：接口层无错误，但业务输出为空；建议检查工作流节点是否读取的是 `image_1` 到 `image_10` 和 `text_input`，或是否需要改字段名。
- 名称判断：该调用同时包含图片输入和 `text_input`，并且截图中存在 `ptj_PicToPic_Listing`；但本次业务输出为空，仍需在 Coze 侧确认该 `workflow_id` 是否就是图生图详情图工作流。

### Changelog

| 日期 | 变更内容 | 原因 |
|---|---|---|
| 2026-06-29 | 按截图命名规则推定为 `ptj_PicToPic_Listing`。 | 用户补充 Coze 工作流名称截图；该工作流仍有 `image_input:null` 异常，需要二次确认。 |
| 2026-06-29 | 新增 WF-003 登记，记录 `image_input:null` 的实测异常。 | 用户提供已创建工作流调用，需要保存和测试。 |

## WF-004 `ptj_PicToPic_Set`

### 基础信息

- 页面/功能：图生图 / 多图输入
- 工作流名称：`ptj_PicToPic_Set`
- 中文名称：批图匠图生图套图
- 业务用途：根据多张参考图生成图生图套图 Prompt 结构。
- Coze 接口：`https://api.coze.cn/v1/workflow/stream_run`
- 请求方式：`POST`
- workflow_id：`7656403827810025510`
- 鉴权变量：`${COZE_API_TOKEN}`
- 状态：已实测，返回 `image_input` Prompt 结构。

### Input Schema

| 字段路径 | 类型 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|---|
| `workflow_id` | string | 是 | `7656403827810025510` | Coze 工作流 ID。 |
| `parameters.image_1` 到 `parameters.image_10` | string | 是 | 用户提供的 Coze 临时图片 URL | 多张参考图。本次提供 10 张图片。 |

### Output Schema

当前状态：已确认。

| 字段路径 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| `output.image_input` | object | `{...}` | 图生图 Prompt 总对象。 |
| `output.image_input.aspect_ratio` | string | `1:1` | 图片比例。 |
| `output.image_input.image_prompts` | array<object> | 多个对象 | 生成图片 Prompt 数组。 |
| `output.image_input.image_prompts[].business_goal` | string | `Highlight product identity...` | 单张图业务目标。 |
| `output.image_input.image_prompts[].image_role` | string | `Product Guide And Hero Image` | 单张图角色。 |
| `output.image_input.image_prompts[].prompt` | string | 英文 Prompt | 可交给图片生成模型的正向 Prompt。 |
| `output.image_input.image_prompts[].negative_prompt` | string | 英文负面 Prompt | 限制水印、假品牌、低清晰度等问题。 |

### 调用示例

```bash
curl -X POST 'https://api.coze.cn/v1/workflow/stream_run' \
  -H "Authorization: Bearer ${COZE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "7656403827810025510",
    "parameters": {
      "image_1": "<Coze image URL>",
      "image_2": "<Coze image URL>",
      "image_3": "<Coze image URL>",
      "image_4": "<Coze image URL>",
      "image_5": "<Coze image URL>",
      "image_6": "<Coze image URL>",
      "image_7": "<Coze image URL>",
      "image_8": "<Coze image URL>",
      "image_9": "<Coze image URL>",
      "image_10": "<Coze image URL>"
    }
  }'
```

### 实测记录

#### 2026-06-29 实测

- 测试输入：10 张图片 URL。
- 是否成功：成功。
- 接口返回：`event: PING` + `event: Message` + `event: Done`。
- token 用量：`input_count=33447`、`output_count=5062`、`token_count=38509`。
- 返回摘要：业务输出包含 `image_input.aspect_ratio` 和 `image_input.image_prompts`。
- 注意事项：本工作流消耗 token 较高，调用方应注意图片数量和超时。
- 名称判断：图片输入返回多条 `image_prompts`，符合图生图套图工作流。

### Changelog

| 日期 | 变更内容 | 原因 |
|---|---|---|
| 2026-06-29 | 按截图命名规则更新为 `ptj_PicToPic_Set`。 | 用户补充 Coze 工作流名称截图，需要让登记册名称和 Coze 后台一致。 |
| 2026-06-29 | 新增 WF-004 登记和多图实测记录。 | 用户提供已创建工作流调用，需要保存和测试。 |

## WF-005 `ptj_TextToPic_Poster`

### 基础信息

- 页面/功能：文生图 / 海报
- 工作流名称：`ptj_TextToPic_Poster`
- 中文名称：批图匠文生图海报
- 业务用途：根据单个文本输入生成电商海报 Prompt。
- Coze 接口：`https://api.coze.cn/v1/workflow/stream_run`
- 请求方式：`POST`
- workflow_id：`7656641215886852146`
- 鉴权变量：`${COZE_API_TOKEN}`
- 状态：已实测，返回海报 Prompt 结构。

### Input Schema

| 字段路径 | 类型 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|---|
| `workflow_id` | string | 是 | `7656641215886852146` | Coze 工作流 ID。 |
| `parameters.input` | string | 是 | `马克杯，16:9` | 商品和图片比例需求。 |

### Output Schema

当前状态：已确认。

| 字段路径 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| `output.aspect_ratio` | string | `16:9` | 图片比例。 |
| `output.poster_prompt` | string | 英文 Prompt | 可用于生成单张电商海报的正向 Prompt。 |
| `output.negative_prompt` | string | 英文负面 Prompt | 限制平台 Logo、水印、二维码、错误文字等问题。 |
| `output.product_name_english` | string | 商品英文名 | 英文商品名。 |
| `output.product_name_origina` | string | 原始商品名 | 原始商品名字段；保留实际字段名。 |
| `output.selling_points` | array/string | 卖点内容 | 工作流提取或生成的卖点。 |
| `output.visible_text` | array/string | 可见文案 | 建议出现在画面中的文字。 |
| `output.search_insights` | array | 搜索洞察 | 市场或搜索洞察。 |
| `output.search_queries` | array | 查询词 | 相关搜索词。 |

### 调用示例

```bash
curl -X POST 'https://api.coze.cn/v1/workflow/stream_run' \
  -H "Authorization: Bearer ${COZE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "7656641215886852146",
    "parameters": {
      "input": "马克杯，16:9"
    }
  }'
```

### 实测记录

#### 2026-06-29 实测

- 测试输入：`parameters.input = "马克杯，16:9"`。
- 是否成功：成功。
- 接口返回：`event: Message` + `event: Done`。
- token 用量：`input_count=3210`、`output_count=2609`、`token_count=5819`。
- 返回摘要：业务输出包含 `aspect_ratio`、`negative_prompt`、`poster_prompt`、`product_name_english`、`product_name_origina`、`search_insights`、`search_queries`、`selling_points`、`visible_text`。
- 结论：适合作为单文本生成电商海报 Prompt 的工作流。
- 名称判断：文本输入返回 `poster_prompt`，符合文生图海报工作流。

### Changelog

| 日期 | 变更内容 | 原因 |
|---|---|---|
| 2026-06-29 | 按截图命名规则更新为 `ptj_TextToPic_Poster`。 | 用户补充 Coze 工作流名称截图，需要让登记册名称和 Coze 后台一致。 |
| 2026-06-29 | 新增 WF-005 登记和单文本实测记录。 | 用户提供已创建工作流调用，需要保存和测试。 |

## WF-006 `ptj_PicToPic_Poster`

### 基础信息

- 页面/功能：图生图 / 海报
- 工作流名称：`ptj_PicToPic_Poster`
- 中文名称：批图匠图生图海报
- 业务用途：根据一张参考图和文本需求生成图生图海报 Prompt。
- Coze 接口：`https://api.coze.cn/v1/workflow/stream_run`
- 请求方式：`POST`
- workflow_id：`7656654649588727871`
- 鉴权变量：`${COZE_API_TOKEN}`
- 状态：已实测，返回 `image_input` Poster Prompt 结构。

### Input Schema

| 字段路径 | 类型 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|---|
| `workflow_id` | string | 是 | `7656654649588727871` | Coze 工作流 ID。 |
| `parameters.image_1` | string | 是 | 用户提供的 Coze 临时图片 URL | 单张参考图。 |
| `parameters.text_input` | string | 是 | `马克杯，9:16` | 商品和图片比例需求。 |

### Output Schema

当前状态：已确认。

| 字段路径 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| `output.image_input` | object | `{...}` | 图生图 Prompt 总对象。 |
| `output.image_input.aspect_ratio` | string | `9:16` | 图片比例。 |
| `output.image_input.image_prompts` | array<object> | 多个对象 | 生成图片 Prompt 数组。 |
| `output.image_input.image_prompts[].business_goal` | string | `Attract international buyers...` | 单张图业务目标。 |
| `output.image_input.image_prompts[].image_role` | string | `Single Ecommerce Poster Image` | 单张图角色。 |
| `output.image_input.image_prompts[].prompt` | string | 英文 Prompt | 可交给图片生成模型的正向 Prompt。 |
| `output.image_input.image_prompts[].negative_prompt` | string | 英文负面 Prompt | 限制水印、错误文字、低清晰度等问题。 |

### 调用示例

```bash
curl -X POST 'https://api.coze.cn/v1/workflow/stream_run' \
  -H "Authorization: Bearer ${COZE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflow_id": "7656654649588727871",
    "parameters": {
      "image_1": "<Coze image URL>",
      "text_input": "马克杯，9:16"
    }
  }'
```

### 实测记录

#### 2026-06-29 实测

- 测试输入：1 张图片 URL + `text_input = "马克杯，9:16"`。
- 是否成功：成功。
- 接口返回：`event: Message` + `event: Done`。
- token 用量：`input_count=3240`、`output_count=1578`、`token_count=4818`。
- 返回摘要：业务输出包含 `image_input.aspect_ratio` 和 `image_input.image_prompts`。
- 结论：适合作为单图参考生成电商图 Prompt 的工作流。
- 名称判断：图片输入 + 文本输入，输出角色包含 `Single Ecommerce Poster Image`，符合图生图海报工作流。

### Changelog

| 日期 | 变更内容 | 原因 |
|---|---|---|
| 2026-06-29 | 按截图命名规则更新为 `ptj_PicToPic_Poster`。 | 用户补充 Coze 工作流名称截图，需要让登记册名称和 Coze 后台一致。 |
| 2026-06-29 | 新增 WF-006 登记和单图加文本实测记录。 | 用户提供已创建工作流调用，需要保存和测试。 |
