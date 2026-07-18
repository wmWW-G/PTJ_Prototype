import { ArrowLeft, Check, ChevronDown, Eye, ImageIcon, X } from "lucide-react";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { assetPath } from "../../../lib/assetPath";
import type { VisualTemplateCapability } from "../liveTypes";
import styles from "./VisualTemplatePicker.module.css";

/** 静态回退模板；后端能力接口暂时不可用时页面仍然完整可操作。 */
export const DEFAULT_VISUAL_TEMPLATES: Record<string, VisualTemplateCapability> = {
  standard_product: {
    id: "standard_product",
    name: "标准商品套图",
    category: "商品展示",
    description: "主图、卖点、细节和场景均衡，适合大多数商品。",
    art_direction: "现代电商商品摄影，主体清楚、背景克制、层级明确。",
    information_focus: ["商品主体", "核心卖点", "材质细节", "使用场景"],
    role_highlights: ["商品主视觉", "核心卖点", "细节特写", "使用场景", "功能展示", "组合总览"],
    preview_images: [
      "demo/generated/mug-front.jpg",
      "demo/generated/mug-handle.jpg",
      "demo/generated/mug-rim.jpg",
      "demo/generated/mug-home.jpg",
      "demo/generated/mug-office.jpg",
      "demo/generated/mug-combo.jpg",
    ],
    fields: [
      { key: "product_name", label: "产品名称", placeholder: "例如：防烫陶瓷马克杯", required: false },
      { key: "core_selling_points", label: "核心卖点", placeholder: "例如：防烫手柄、可进洗碗机", required: false },
      { key: "target_audience", label: "目标人群", placeholder: "例如：办公室白领、礼品采购商", required: false },
      { key: "usage_scenarios", label: "使用场景", placeholder: "例如：办公室、居家早餐", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的文字", required: false },
    ],
  },
  supplier_strength: {
    id: "supplier_strength",
    name: "企业实力套图",
    category: "企业实力",
    description: "工厂、品控、服务和资质信息丰富，适合 B2B 采购展示。",
    art_direction: "海外 B2B 供应商信息图，用工厂、仓库、质检、团队和产品形成高信息密度拼贴。",
    information_focus: ["工厂规模与历史", "OEM/ODM 能力", "质量控制", "交付与服务", "认证与合作背书"],
    role_highlights: ["企业总览", "仓储与交付", "品控流程", "研发与定制", "认证背书", "产能与服务"],
    preview_images: [
      "demo/generated/ai-supplier-factory.jpg",
      "demo/generated/ai-supplier-warehouse.jpg",
      "demo/generated/ai-supplier-quality.jpg",
      "demo/generated/ai-supplier-design.jpg",
      "demo/generated/ai-supplier-warehouse.jpg",
      "demo/generated/ai-supplier-factory.jpg",
    ],
    fields: [
      { key: "company_name", label: "公司名称", placeholder: "例如：Ningbo Example Manufacturing Co., Ltd.", required: false },
      { key: "established_years", label: "成立时间 / 经验", placeholder: "例如：成立于 1995 年，30 年制造经验", required: false },
      { key: "oem_odm", label: "OEM / ODM 能力", placeholder: "例如：支持来样、包装和结构定制", required: false },
      { key: "factory_capacity", label: "工厂与产能", placeholder: "例如：厂房面积、月产能、设备数量", required: false },
      { key: "certifications", label: "认证 / 检测", placeholder: "例如：FSC、BSCI、EN71；只填真实拥有的", required: false },
      { key: "service_capabilities", label: "服务能力", placeholder: "例如：打样、质检、仓储、交付支持", required: false },
      { key: "cooperative_brands", label: "合作客户 / 市场", placeholder: "例如：合作品牌或主要出口市场", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的标题或短句", required: false },
    ],
  },
  minimal_premium: {
    id: "minimal_premium",
    name: "极简质感套图",
    category: "极简质感",
    description: "少文字、强材质和留白，适合强调高级感的商品。",
    art_direction: "高端编辑式商品摄影，大面积留白、柔和定向光和克制色彩。",
    information_focus: ["材质与工艺", "产品轮廓", "品牌语气", "核心价值"],
    role_highlights: ["极简主视觉", "材质微距", "轮廓侧影", "高级场景", "单一卖点", "品牌收束"],
    preview_images: [
      "demo/generated/mug-front.jpg",
      "demo/generated/mug-rim.jpg",
      "demo/generated/mug-handle.jpg",
      "demo/generated/mug-office.jpg",
      "demo/generated/mug-home.jpg",
      "demo/generated/mug-combo.jpg",
    ],
    fields: [
      { key: "product_name", label: "产品名称", placeholder: "例如：骨瓷咖啡杯", required: false },
      { key: "material_craft", label: "材质 / 工艺", placeholder: "例如：高温骨瓷、釉下彩", required: false },
      { key: "brand_tone", label: "品牌气质", placeholder: "例如：安静、理性、北欧高级感", required: false },
      { key: "core_selling_points", label: "核心卖点", placeholder: "建议只填 1–3 个最重要卖点", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "例如：Quietly refined", required: false },
    ],
  },
  lifestyle_story: {
    id: "lifestyle_story",
    name: "场景故事套图",
    category: "商品展示",
    description: "用真实使用场景串联整套，突出人群、情绪和生活方式。",
    art_direction: "自然生活方式广告摄影，以同一人物、空间和色调形成连续故事。",
    information_focus: ["目标人群", "使用场景", "情绪氛围", "商品带来的变化"],
    role_highlights: ["场景开篇", "人物使用", "关键细节", "功能瞬间", "情绪氛围", "商品收束"],
    preview_images: [
      "demo/generated/mug-home.jpg",
      "demo/generated/mug-office.jpg",
      "demo/generated/mug-front.jpg",
      "demo/generated/mug-combo.jpg",
      "demo/generated/mug-handle.jpg",
      "demo/generated/mug-rim.jpg",
    ],
    fields: [
      { key: "target_audience", label: "目标人群", placeholder: "例如：城市独居青年", required: false },
      { key: "usage_scenarios", label: "使用场景", placeholder: "例如：清晨早餐、通勤办公室", required: false },
      { key: "emotion_tone", label: "情绪氛围", placeholder: "例如：温暖、松弛、有生活气息", required: false },
      { key: "core_selling_points", label: "核心卖点", placeholder: "需要通过场景体现的卖点", required: false },
      { key: "visible_copy", label: "希望出现的文案", placeholder: "只填写必须准确出现的文字", required: false },
    ],
  },
};

interface VisualTemplatePickerProps {
  value: string;
  supplementalInfo: Record<string, string>;
  templates: Record<string, VisualTemplateCapability>;
  onChange: (templateId: string) => void;
  onInfoChange: (value: Record<string, string>) => void;
}

/**
 * 展示当前视觉模板，并通过右侧抽屉让用户预览和切换整套风格。
 *
 * @param props.value 已提交使用的模板 ID。
 * @param props.supplementalInfo 用户填写的可选模板信息。
 * @param props.templates 后端或静态回退提供的模板表。
 * @param props.onChange 用户确认新模板时触发。
 * @param props.onInfoChange 任一选填字段变化时触发。
 * @returns 紧凑模板摘要、选填信息面板和选择抽屉。
 */
export function VisualTemplatePicker({
  value,
  supplementalInfo,
  templates,
  onChange,
  onInfoChange,
}: VisualTemplatePickerProps) {
  const templateList = useMemo(() => Object.values(templates), [templates]);
  const selected = templates[value] ?? templateList[0] ?? DEFAULT_VISUAL_TEMPLATES.standard_product;
  const [isOpen, setIsOpen] = useState(false);
  const [draftValue, setDraftValue] = useState(selected.id);
  const [category, setCategory] = useState("推荐");
  const [detailTemplateId, setDetailTemplateId] = useState<string | null>(null);
  const categories = ["推荐", ...new Set(templateList.map((item) => item.category))];
  const visibleTemplates = category === "推荐"
    ? templateList
    : templateList.filter((item) => item.category === category);
  const filledCount = selected.fields.filter((field) => supplementalInfo[field.key]?.trim()).length;
  const detailTemplate = detailTemplateId ? templates[detailTemplateId] : null;

  /** 打开抽屉时以当前模板为草稿，取消操作不会污染正式选择。 */
  function openDrawer() {
    setDraftValue(selected.id);
    setCategory("推荐");
    setDetailTemplateId(null);
    setIsOpen(true);
  }

  /** 关闭抽屉并清除详情层，确保下次打开仍从模板列表开始。 */
  function closeDrawer() {
    setDetailTemplateId(null);
    setIsOpen(false);
  }

  /** 确认草稿模板，同时保留名称相同的已填信息，减少重复输入。 */
  function confirmTemplate() {
    onChange(draftValue);
    closeDrawer();
  }

  /** 从详情页直接确认当前模板，省去返回列表后再次确认的步骤。 */
  function confirmDetailTemplate() {
    if (!detailTemplate) return;
    onChange(detailTemplate.id);
    closeDrawer();
  }

  /**
   * 更新一条选填信息。
   *
   * @param key 稳定字段名。
   * @param nextValue 用户最新输入。
   */
  function updateInfo(key: string, nextValue: string) {
    onInfoChange({ ...supplementalInfo, [key]: nextValue });
  }

  return (
    <section className={styles.templateSection} aria-label="生图模板">
      <div className={styles.sectionHeading}>
        <div>
          <span>生图模板</span>
          <small>预览整套图片的信息结构与视觉方向</small>
        </div>
        <button type="button" onClick={openDrawer}>更换模板</button>
      </div>

      <div className={styles.selectedTemplate}>
        <div className={styles.previewStrip} aria-hidden="true">
          {selected.preview_images.slice(0, 4).map((image) => (
            <img key={image} src={assetPath(image)} alt="" />
          ))}
        </div>
        <div className={styles.selectedCopy}>
          <strong>{selected.name}</strong>
          <span>{selected.description}</span>
        </div>
      </div>

      <details className={styles.infoPanel}>
        <summary>
          <span>补充模板信息（选填）<small> · 已填写 {filledCount}/{selected.fields.length}</small></span>
          <ChevronDown size={16} />
        </summary>
        <p>不填写也可以生成；系统会根据商品图片和“产品+卖点”自动规划。</p>
        <div className={styles.infoGrid}>
          {selected.fields.map((field) => (
            <label key={field.key}>
              <span>{field.label}</span>
              <input
                aria-label={field.label}
                value={supplementalInfo[field.key] ?? ""}
                placeholder={field.placeholder}
                required={field.required}
                maxLength={500}
                onChange={(event) => updateInfo(field.key, event.target.value)}
              />
            </label>
          ))}
        </div>
      </details>

      {isOpen && createPortal((
        <div className={styles.drawerLayer}>
          <button className={styles.backdrop} type="button" aria-label="关闭模板选择" onClick={closeDrawer} />
          <aside
            className={`${styles.drawer} ${detailTemplate ? styles.detailDrawer : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label="选择生图模板"
          >
            <header>
              {detailTemplate ? (
                <div className={styles.detailHeader}>
                  <button type="button" aria-label="返回模板列表" onClick={() => setDetailTemplateId(null)}>
                    <ArrowLeft size={18} />
                  </button>
                  <div>
                    <h2>{detailTemplate.name}详情</h2>
                    <span>查看这套模板的完整画面结构和可补充信息。</span>
                  </div>
                </div>
              ) : (
                <div>
                  <strong>选择生图模板</strong>
                  <span>先看整套会怎么组织，再决定需要补充什么信息。</span>
                </div>
              )}
              <button type="button" aria-label="关闭" onClick={closeDrawer}><X size={19} /></button>
            </header>

            {detailTemplate ? (
              <>
                <div className={styles.detailView}>
                  <div className={styles.detailPreview} aria-label={`${detailTemplate.name}预览图`}>
                    {detailTemplate.preview_images.slice(0, 6).map((image, index) => (
                      <img key={`${image}-${index}`} src={assetPath(image)} alt={`${detailTemplate.name}示例 ${index + 1}`} />
                    ))}
                  </div>

                  <div className={styles.detailIntro}>
                    <span>{detailTemplate.category}</span>
                    <p>{detailTemplate.description}</p>
                    <small>{detailTemplate.art_direction}</small>
                  </div>

                  <section className={styles.detailSection}>
                    <h3>这套会生成什么</h3>
                    <ol className={styles.detailRoles}>
                      {detailTemplate.role_highlights.map((role, index) => (
                        <li key={role}><b>{String(index + 1).padStart(2, "0")}</b><span>{role}</span></li>
                      ))}
                    </ol>
                  </section>

                  <section className={styles.detailSection}>
                    <h3>重点表达信息</h3>
                    <div className={styles.detailFocus}>
                      {detailTemplate.information_focus.map((focus) => <span key={focus}>{focus}</span>)}
                    </div>
                  </section>

                  <section className={styles.detailSection}>
                    <h3>可补充信息（均选填）</h3>
                    <p>不填写也能生成；填写得越具体，整套内容会越贴近你的真实业务。</p>
                    <div className={styles.detailFields}>
                      {detailTemplate.fields.map((field) => (
                        <div key={field.key}><strong>{field.label}</strong><span>{field.placeholder}</span></div>
                      ))}
                    </div>
                  </section>
                </div>

                <footer>
                  <button type="button" onClick={confirmDetailTemplate}>选择并使用此模板</button>
                </footer>
              </>
            ) : (
              <>
                <div className={styles.categoryTabs} aria-label="模板分类">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={category === item ? styles.activeCategory : ""}
                      onClick={() => setCategory(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>

                <div className={styles.templateGrid}>
                  {visibleTemplates.map((item) => {
                    const active = draftValue === item.id;
                    return (
                      <article key={item.id} className={`${styles.templateCard} ${active ? styles.activeCard : ""}`}>
                        <button
                          type="button"
                          className={styles.cardSelect}
                          aria-label={`选择${item.name}`}
                          aria-pressed={active}
                          onClick={() => setDraftValue(item.id)}
                        >
                          <div className={styles.cardPreview}>
                            {item.preview_images.slice(0, 4).map((image) => (
                              <img key={image} src={assetPath(image)} alt="" />
                            ))}
                            {active && <i><Check size={14} /></i>}
                          </div>
                          <strong>{item.name}</strong>
                          <span>{item.description}</span>
                          {active && (
                            <ul>
                              {item.information_focus.map((focus) => <li key={focus}>{focus}</li>)}
                            </ul>
                          )}
                        </button>
                        <button
                          type="button"
                          className={styles.detailButton}
                          aria-label={`查看${item.name}详情`}
                          onClick={() => setDetailTemplateId(item.id)}
                        >
                          <Eye size={14} />查看详情
                        </button>
                      </article>
                    );
                  })}
                  {visibleTemplates.length === 0 && (
                    <div className={styles.emptyCategory}><ImageIcon size={22} /><span>该分类暂无模板</span></div>
                  )}
                </div>

                <footer>
                  <button type="button" onClick={confirmTemplate}>使用此模板</button>
                </footer>
              </>
            )}
          </aside>
        </div>
      ), document.body)}
    </section>
  );
}
