import { ImagePlus, Upload, X } from "lucide-react";
import {
  type ClipboardEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import styles from "../GenerationPage.module.css";

interface ImagePreview {
  file: File;
  url: string;
}

interface PromptImageComposerProps {
  label: string;
  value: string;
  placeholder: string;
  maxLength: number;
  onChange: (value: string) => void;
  onImagesChange: (urls: string[], files: File[]) => void;
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
 * @param props.value 当前文字内容。
 * @param props.placeholder 文字为空时展示的引导。
 * @param props.maxLength 允许输入的最大字符数。
 * @param props.onChange 文字更新回调。
 * @param props.onImagesChange 图片临时 URL 和原始文件更新回调。
 * @param props.acceptedTypes 允许的 MIME 类型。
 * @param props.maxFileSize 单张图片字节上限。
 * @param props.maxImages 最多允许的参考图数量。
 * @returns 一个同时支持文字与图片的可访问输入面板。
 */
export function PromptImageComposer({
  label,
  value,
  placeholder,
  maxLength,
  onChange,
  onImagesChange,
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  maxImages = 10,
}: PromptImageComposerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewsRef = useRef<ImagePreview[]>([]);
  const [previews, setPreviews] = useState<ImagePreview[]>([]);
  const [previewing, setPreviewing] = useState<ImagePreview | null>(null);
  const [error, setError] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  previewsRef.current = previews;

  /** 组件卸载时释放所有 blob URL，避免反复上传造成浏览器内存累积。 */
  useEffect(
    () => () => {
      previewsRef.current.forEach(({ url }) => URL.revokeObjectURL(url));
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

  return (
    <section className={styles.promptComposer} aria-label="商品图片与补充说明">
      <header className={styles.composerHeading}>
        <div>
          <span className={styles.fieldLabel}>商品参考图</span>
          <b>优先输入</b>
        </div>
        <small>最多 {maxImages} 张，单张不超过 {Math.round(maxFileSize / 1024 / 1024)}MB</small>
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
              <strong>{previews.length > 0 ? "继续添加商品参考图" : "上传商品参考图"}</strong>
              <small>点击选择，也可以直接粘贴或拖拽到这里</small>
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
          <span><Upload size={13} />图片决定商品主体，文字用于补充生成要求</span>
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

      <p className={styles.composerHelp}>
        有参考图时会优先识别并保留商品特征；没有图片时，才根据文字从头生成。
      </p>
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
