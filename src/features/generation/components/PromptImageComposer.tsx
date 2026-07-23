import {
  BadgePlus,
  Box,
  ChevronDown,
  ImagePlus,
  Palette,
  Upload,
  X,
} from "lucide-react";
import {
  type ClipboardEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { LogoPosition } from "../../tasks/types";
import styles from "../GenerationPage.module.css";

interface ImagePreview {
  file: File;
  url: string;
}

interface PromptImageComposerProps {
  /** 主图使用上下双图片区；其他类型沿用统一商品参考图输入。 */
  layout?: "standard" | "main";
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onChange: (value: string) => void;
  onImagesChange: (urls: string[], files: File[]) => void;
  /** 全部真实生图类型共用的参考设计图回调；该组图片只负责视觉风格与构图。 */
  onStyleImagesChange?: (urls: string[], files: File[]) => void;
  logoPosition: LogoPosition;
  onLogoChange: (file: File | null, position: LogoPosition) => void;
  acceptedTypes?: string[];
  maxFileSize?: number;
  maxImages?: number;
}

const DEFAULT_ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DEFAULT_MAX_FILE_SIZE = 4 * 1024 * 1024;

/**
 * 将文字需求和参考图放进同一个输入面板。
 *
 * 图片是这个输入面板的主输入，文字只用于补充卖点、风格和保留要求。
 * 用户可以粘贴图片、拖入图片或点击上传，也可以在下方填写补充说明。
 * 图片只在浏览器内生成临时预览 URL；真正提交时仍把原始 File 交给父组件，
 * 因此不会改变现有的后端上传和文生图 / 图生图自动分流逻辑。
 *
 * @param props.label 补充文字字段标题。
 * @param props.layout 输入区布局；两种布局均展示独立参考设计图。
 * @param props.value 当前文字内容。
 * @param props.placeholder 文字为空时展示的引导。
 * @param props.maxLength 允许输入的最大字符数。
 * @param props.onChange 文字更新回调。
 * @param props.onImagesChange 图片临时 URL 和原始文件更新回调。
 * @param props.onStyleImagesChange 参考设计图更新回调。
 * @param props.acceptedTypes 允许的 MIME 类型。
 * @param props.maxFileSize 单张图片字节上限。
 * @param props.maxImages 最多允许的参考图数量。
 * @returns 一个同时支持文字与图片的可访问输入面板。
 */
export function PromptImageComposer({
  layout = "standard",
  label,
  value,
  placeholder,
  maxLength,
  onChange,
  onImagesChange,
  onStyleImagesChange,
  logoPosition,
  onLogoChange,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxImages = 10,
}: PromptImageComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<ImagePreview[]>([]);
  const stylePreviewRef = useRef<ImagePreview | null>(null);
  const logoPreviewRef = useRef<ImagePreview | null>(null);
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const [stylePreview, setStylePreview] = useState<ImagePreview | null>(null);
  const [logoPreview, setLogoPreview] = useState<ImagePreview | null>(null);
  const [previewing, setPreviewing] = useState<ImagePreview | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isLogoOpen, setIsLogoOpen] = useState(false);

  previewsRef.current = previews;
  stylePreviewRef.current = stylePreview;
  logoPreviewRef.current = logoPreview;

  /** 组件卸载时释放所有 blob URL，避免反复上传造成浏览器内存累积。 */
  useEffect(
    () => () => {
      previewsRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
      if (stylePreviewRef.current) URL.revokeObjectURL(stylePreviewRef.current.url);
      if (logoPreviewRef.current) URL.revokeObjectURL(logoPreviewRef.current.url);
    },
    [],
  );

  /** 预览弹窗打开时允许按 Escape 关闭。 */
  useEffect(() => {
    if (!previewing) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPreviewing(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewing]);

  /**
   * 将同一份图片状态同步给父组件。
   *
   * @param next 下一组有效图片预览。
   */
  function commitPreviews(next: ImagePreview[]) {
    setPreviews(next);
    onImagesChange(
      next.map(({ url }) => url),
      next.map(({ file }) => file),
    );
  }

  /**
   * 校验并追加来自上传、拖拽或剪贴板的图片。
   *
   * @param files 待加入的原始文件。
   */
  function addFiles(files: File[]) {
    setError("");
    const remaining = Math.max(0, maxImages - previews.length);
    const candidates = files.slice(0, remaining);
    const invalid = candidates.find(
      (file) => !acceptedTypes.includes(file.type) || file.size > maxFileSize,
    );

    if (invalid) {
      setError(
        `${invalid.name} 格式不支持或超过 ${Math.round(maxFileSize / 1024 / 1024)}MB`,
      );
      return;
    }

    if (files.length > remaining) {
      setError(`最多添加 ${maxImages} 张参考图`);
    }

    if (candidates.length === 0) return;
    const additions = candidates.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
    commitPreviews([...previews, ...additions]);
    console.info("[批图匠] 参考图已加入文字输入区", {
      source: "composer",
      count: additions.length,
    });
  }

  /**
   * 删除一张参考图，并同步关闭正在查看的同一张预览。
   *
   * @param target 要删除的图片预览。
   */
  function removePreview(target: ImagePreview) {
    URL.revokeObjectURL(target.url);
    if (previewing?.url === target.url) setPreviewing(null);
    commitPreviews(previews.filter(({ url }) => url !== target.url));
  }

  /**
   * 保存唯一一张参考设计图。
   *
   * 参考设计图只负责构图和风格，父组件会把它写入独立请求字段；这能避免
   * 后端商品分析把竞品图中的商品、文字或品牌误当成用户自己的素材。
   *
   * @param file 用户上传或拖入的参考设计图。
   */
  function setStyleReference(file: File) {
    setError("");
    if (!acceptedTypes.includes(file.type) || file.size > maxFileSize) {
      setError(
        `${file.name} 格式不支持或超过 ${Math.round(maxFileSize / 1024 / 1024)}MB`,
      );
      return;
    }
    if (stylePreview) URL.revokeObjectURL(stylePreview.url);
    const next = { file, url: URL.createObjectURL(file) };
    setStylePreview(next);
    onStyleImagesChange?.([next.url], [file]);
    console.info("[批图匠] 参考设计已加入任务", { filename: file.name });
  }

  /** 移除参考设计图，并同步释放浏览器临时 URL。 */
  function removeStyleReference() {
    if (!stylePreview) return;
    URL.revokeObjectURL(stylePreview.url);
    if (previewing?.url === stylePreview.url) setPreviewing(null);
    setStylePreview(null);
    onStyleImagesChange?.([], []);
  }

  /**
   * 接收拖入参考设计区的单张图片。
   *
   * @param event 参考设计上传区的拖放事件。
   */
  function handleStyleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) setStyleReference(file);
  }

  /**
   * 校验并保存唯一一张品牌 Logo。
   *
   * Logo 与商品参考图保持独立，父组件可以把它写入专用后端字段，避免
   * 商品分析模型误把品牌图形当成商品主体。
   *
   * @param file 用户选择的 Logo 图片。
   */
  function setLogoFile(file: File) {
    setError("");
    if (!acceptedTypes.includes(file.type) || file.size > maxFileSize) {
      setError(
        `${file.name} 格式不支持或超过 ${Math.round(maxFileSize / 1024 / 1024)}MB`,
      );
      return;
    }
    if (logoPreview) URL.revokeObjectURL(logoPreview.url);
    const next = { file, url: URL.createObjectURL(file) };
    setLogoPreview(next);
    onLogoChange(file, logoPosition);
    // 文件通过校验并同步给父组件后，当前操作已经完成。立即收起设置面板，
    // 让用户直接看到“Logo 已添加”的紧凑状态；校验失败会在上方提前返回，
    // 因此错误文件不会误关面板，用户仍可在原位置重新选择。
    setIsLogoOpen(false);
    console.info("[批图匠] 品牌 Logo 已加入生成任务", {
      filename: file.name,
      position: logoPosition,
    });
  }

  /** 移除当前 Logo，并释放浏览器预览 URL。 */
  function removeLogo() {
    if (!logoPreview) return;
    URL.revokeObjectURL(logoPreview.url);
    if (previewing?.url === logoPreview.url) setPreviewing(null);
    setLogoPreview(null);
    onLogoChange(null, logoPosition);
  }

  /**
   * 更新 Logo 位置，同时把当前 Logo 文件重新同步给父组件。
   *
   * @param position 新的 Logo 位置。
   */
  function updateLogoPosition(position: LogoPosition) {
    onLogoChange(logoPreview?.file ?? null, position);
  }

  /**
   * 仅在剪贴板包含图片时接管粘贴；普通文字仍由 textarea 原生处理。
   *
   * @param event 合并输入区内冒泡的剪贴板事件。
   */
  function handlePaste(event: ClipboardEvent<HTMLElement>) {
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));

    if (imageFiles.length === 0) return;
    event.preventDefault();
    addFiles(imageFiles);
  }

  /**
   * 接收拖入整个输入面板的图片。
   *
   * @param event 浏览器拖放事件。
   */
  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(Array.from(event.dataTransfer.files));
  }

  // Logo 入口和设置浮层在主图、套图等布局中完全复用。将它们提取成同一份
  // JSX，避免主图双卡片改版后出现两套行为或文案逐渐不一致。
  const logoTriggerControl = (
    <button
      className={`${styles.logoTrigger} ${logoPreview ? styles.logoTriggerActive : ""}`}
      type="button"
      aria-expanded={isLogoOpen}
      aria-controls="logo-quick-panel"
      onClick={() => setIsLogoOpen((open) => !open)}
    >
      {logoPreview ? (
        <img src={logoPreview.url} alt="" aria-hidden="true" />
      ) : (
        <BadgePlus size={14} />
      )}
      <span>{logoPreview ? "Logo 已添加" : "添加 Logo"}</span>
    </button>
  );

  const logoSettingsPanel = isLogoOpen ? (
    <section
      id="logo-quick-panel"
      className={styles.logoPopover}
      role="dialog"
      aria-label="添加品牌 Logo"
    >
      <header>
        <div>
          <strong>品牌 Logo</strong>
          <small>上传 1 张，生成时尽量原样保留</small>
        </div>
        <button type="button" aria-label="关闭 Logo 设置" onClick={() => setIsLogoOpen(false)}>
          <X size={16} />
        </button>
      </header>

      {logoPreview ? (
        <div className={styles.logoSelectedRow}>
          <button
            type="button"
            aria-label={`查看 Logo ${logoPreview.file.name}`}
            onClick={() => setPreviewing(logoPreview)}
          >
            <img src={logoPreview.url} alt={logoPreview.file.name} />
          </button>
          <div>
            <strong>{logoPreview.file.name}</strong>
            <small>{Math.max(1, Math.round(logoPreview.file.size / 1024))} KB</small>
          </div>
          <button type="button" aria-label="移除 Logo" onClick={removeLogo}>
            <X size={15} />
          </button>
        </div>
      ) : (
        <button
          className={styles.logoUploadButton}
          type="button"
          onClick={() => logoInputRef.current?.click()}
        >
          <ImagePlus size={18} />
          <span><strong>上传 Logo</strong><small>PNG、JPG 或 WebP</small></span>
        </button>
      )}

      <label className={styles.logoPositionControl}>
        <span>显示位置</span>
        <span className={styles.selectWrap}>
          <select
            aria-label="Logo 显示位置"
            value={logoPosition}
            onChange={(event) => updateLogoPosition(event.target.value as LogoPosition)}
          >
            <option value="top-left">左上角</option>
            <option value="top-right">右上角</option>
            <option value="bottom-left">左下角</option>
            <option value="bottom-right">右下角</option>
            <option value="center">居中</option>
          </select>
          <ChevronDown size={14} />
        </span>
      </label>
      <p>默认使用克制尺寸和安全边距，不遮挡商品主体。</p>
      <input
        ref={logoInputRef}
        className={styles.composerFileInput}
        type="file"
        aria-label="选择 Logo 文件"
        accept={acceptedTypes.join(",")}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setLogoFile(file);
          event.target.value = "";
        }}
      />
    </section>
  ) : null;

  return (
    <section
      className={`${styles.promptComposer} ${layout === "main" ? styles.mainPromptComposer : ""}`}
      aria-label={layout === "main" ? "主图素材与补充说明" : "商品图片与补充说明"}
      // standard 布局的 composerShell 已处理粘贴；外层只给 main 绑定，避免
      // 冒泡后把同一张剪贴板图片添加两次并遗留额外 Blob URL。
      onPaste={layout === "main" ? handlePaste : undefined}
    >
      <section className={styles.mainReferenceCard} aria-label="参考设计图">
        <header>
          <span className={styles.mainReferenceIcon}><Palette size={18} /></span>
          <div>
            <strong>参考设计图</strong>
            <small>{layout === "main" ? "参考它的构图、光线和画面风格" : "只学习整套的信息结构、构图和视觉风格"}</small>
          </div>
          <b>{stylePreview ? "1/1" : "0/1"}</b>
        </header>

        {stylePreview ? (
          <div className={styles.mainSelectedAsset}>
            <button type="button" aria-label={`查看参考设计图 ${stylePreview.file.name}`} onClick={() => setPreviewing(stylePreview)}>
              <img src={stylePreview.url} alt={stylePreview.file.name} />
            </button>
            <div>
              <strong>{stylePreview.file.name}</strong>
              <small>{layout === "main" ? "仅学习构图与风格，不复制商品和品牌" : "只学习整套信息结构、构图和视觉风格，不复制商品和品牌"}</small>
            </div>
            <button type="button" aria-label="移除参考设计图" onClick={removeStyleReference}><X size={15} /></button>
          </div>
        ) : (
          <div className={styles.mainReferenceDropzone} onDragOver={(event) => event.preventDefault()} onDrop={handleStyleDrop}>
            <button type="button" aria-label="上传参考设计图" onClick={() => styleInputRef.current?.click()}>
              <Upload size={19} />
              <span><strong>拖拽图片到这里</strong><small>或点击选择 PNG、JPG、WebP</small></span>
            </button>
          </div>
        )}

        <input ref={styleInputRef} className={styles.composerFileInput} type="file" aria-label="选择参考设计图文件" accept={acceptedTypes.join(",")} tabIndex={-1} onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) setStyleReference(file);
          event.target.value = "";
        }} />
      </section>

      {layout === "main" && (
        <>
          <section className={styles.mainReferenceCard} aria-label="产品素材图">
            <header>
              <span className={styles.mainReferenceIcon}><Box size={18} /></span>
              <div>
                <strong>产品素材图</strong>
                <small>上传自己的商品正面、侧面、背面或细节</small>
              </div>
              <div className={styles.mainCardHeaderActions}>
                <b>{previews.length}/{maxImages}</b>
                {logoTriggerControl}
              </div>
            </header>

            {logoSettingsPanel}

            <div
              className={`${styles.mainReferenceDropzone} ${styles.mainProductDropzone} ${isDragging ? styles.composerDragging : ""}`}
              role="group"
              aria-label="产品素材图输入框"
              tabIndex={0}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsDragging(false);
                }
              }}
              onDrop={handleDrop}
            >
              <button
                type="button"
                aria-label="上传产品素材图"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus size={19} />
                <span>
                  <strong>{previews.length > 0 ? "继续添加产品素材图" : "拖拽图片到这里"}</strong>
                  <small>{previews.length > 0 ? "可继续上传其他角度或细节" : "或点击选择，也可以直接粘贴"}</small>
                </span>
              </button>

              {previews.length > 0 && (
                <div className={styles.composerPreviews} aria-label="已添加的参考图">
                  {previews.map((preview) => (
                    <figure key={preview.url} className={styles.composerPreview}>
                      <button
                        className={styles.previewOpenButton}
                        type="button"
                        aria-label={`查看图片 ${preview.file.name}`}
                        onClick={() => setPreviewing(preview)}
                      >
                        <img src={preview.url} alt={preview.file.name} />
                      </button>
                      <button
                        className={styles.previewRemoveButton}
                        type="button"
                        aria-label={`移除图片 ${preview.file.name}`}
                        onClick={() => removePreview(preview)}
                      >
                        <X size={14} />
                      </button>
                    </figure>
                  ))}
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              className={styles.composerFileInput}
              type="file"
              aria-label="选择产品素材图文件"
              accept={acceptedTypes.join(",")}
              multiple
              tabIndex={-1}
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </section>

          <section className={styles.mainSupplementPanel} aria-label="主图补充要求">
            <div className={styles.composerTextHeading}>
              <div><strong>{label}</strong></div>
              <small>{value.length}/{maxLength}</small>
            </div>
            <textarea
              aria-label={label}
              value={value}
              maxLength={maxLength}
              placeholder={placeholder}
              onChange={(event) => onChange(event.target.value)}
            />
            <div className={styles.composerFooter}>
              <span><Upload size={13} />图片决定主体，文字只补充必要要求</span>
            </div>
          </section>
        </>
      )}

      {layout !== "main" && (
        <>
          <header className={styles.composerHeading}>
            <div>
              <span className={styles.fieldLabel}>商品参考图</span>
              <b>优先输入</b>
            </div>
            <div className={styles.composerHeadingActions}>
              {logoTriggerControl}
              {logoSettingsPanel}
            </div>
          </header>

          <div
            className={`${styles.composerShell} ${isDragging ? styles.composerDragging : ""}`}
            role="group"
            aria-label="图片优先输入框"
            tabIndex={0}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragging(false);
              }
            }}
            onDrop={handleDrop}
            onPaste={handlePaste}
          >
        <div className={styles.composerImageLead}>
          <button
            className={styles.composerUploadButton}
            type="button"
            aria-label="上传商品参考图"
            onClick={() => inputRef.current?.click()}
          >
            <span className={styles.composerUploadIcon}><ImagePlus size={23} /></span>
            <span>
              <strong>
                {previews.length > 0 ? "继续添加商品参考图" : "上传商品参考图"}
              </strong>
              <small>
                点击选择，也可以直接粘贴或拖拽到这里
              </small>
            </span>
          </button>
          <b>{previews.length}/{maxImages} 张</b>
        </div>

        {previews.length > 0 && (
          <div className={styles.composerPreviews} aria-label="已添加的参考图">
            {previews.map((preview) => (
              <figure key={preview.url} className={styles.composerPreview}>
                <button
                  className={styles.previewOpenButton}
                  type="button"
                  aria-label={`查看图片 ${preview.file.name}`}
                  onClick={() => setPreviewing(preview)}
                >
                  <img src={preview.url} alt={preview.file.name} />
                </button>
                <button
                  className={styles.previewRemoveButton}
                  type="button"
                  aria-label={`移除图片 ${preview.file.name}`}
                  onClick={() => removePreview(preview)}
                >
                  <X size={14} />
                </button>
              </figure>
            ))}
          </div>
        )}

        <div className={styles.composerTextHeading}>
          <div>
            <strong>{label}</strong>
          </div>
          <small>{value.length}/{maxLength}</small>
        </div>

        <textarea
          aria-label={label}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />

        <div className={styles.composerFooter}>
          <span>
            <Upload size={13} />
            图片决定商品主体，文字用于补充生成要求
          </span>
        </div>

        <input
          ref={inputRef}
          className={styles.composerFileInput}
          type="file"
          aria-label="选择商品参考图文件"
          accept={acceptedTypes.join(",")}
          multiple
          tabIndex={-1}
          onChange={(event) => {
            addFiles(Array.from(event.target.files ?? []));
            // 清空 input，保证用户删除后仍可重新选择同一个文件。
            event.target.value = "";
          }}
        />
          </div>
        </>
      )}

      {error && <p className={styles.errorText} role="alert">{error}</p>}

      {previewing && createPortal(
        <div className={styles.imagePreviewLayer}>
          <button
            className={styles.imagePreviewBackdrop}
            type="button"
            aria-label="关闭图片预览"
            onClick={() => setPreviewing(null)}
          />
          <section
            className={styles.imagePreviewDialog}
            role="dialog"
            aria-modal="true"
            aria-label={`查看图片 ${previewing.file.name}`}
          >
            <header>
              <div>
                <strong>{previewing.file.name}</strong>
                <span>{Math.max(1, Math.round(previewing.file.size / 1024))} KB</span>
              </div>
              <button
                type="button"
                aria-label="关闭图片预览"
                onClick={() => setPreviewing(null)}
              >
                <X size={19} />
              </button>
            </header>
            <div className={styles.imagePreviewStage}>
              <img src={previewing.url} alt={previewing.file.name} />
            </div>
          </section>
        </div>,
        document.body,
      )}
    </section>
  );
}
