import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import styles from "../GenerationPage.module.css";

interface UploadPreview { file: File; url: string; }
interface UploadZoneProps {
  label: string;
  onChange?: (urls: string[]) => void;
  onFilesChange?: (files: File[]) => void;
  acceptedTypes?: string[];
  maxFileSize?: number;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff", "image/gif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

/**
 * 图片上传、拖拽、校验和预览组件。
 *
 * @param props.label 当前上传区的业务名称。
 * @param props.onChange 预览 URL 变化后的回调。
 * @returns 可访问的上传区。
 */
export function UploadZone({
  label,
  onChange,
  onFilesChange,
  acceptedTypes = ACCEPTED_TYPES,
  maxFileSize = MAX_FILE_SIZE,
}: UploadZoneProps) {
  const inputId = useId();
  const [previews, setPreviews] = useState<UploadPreview[]>([]);
  const [error, setError] = useState("");
  const previewsRef = useRef(previews);

  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach(({ url }) => URL.revokeObjectURL(url)), []);

  /** 校验并加入用户选择的图片。 */
  function addFiles(files: File[]) {
    setError("");
    const nextFiles = files.slice(0, Math.max(0, 10 - previews.length));
    const invalid = nextFiles.find((file) => !acceptedTypes.includes(file.type) || file.size > maxFileSize);
    if (invalid) {
      setError(`${invalid.name} 格式不支持或超过 ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      return;
    }
    if (files.length + previews.length > 10) setError("单个上传区最多上传 10 张图片");
    const additions = nextFiles.map((file) => ({ file, url: URL.createObjectURL(file) }));
    const next = [...previews, ...additions];
    setPreviews(next);
    onChange?.(next.map(({ url }) => url));
    onFilesChange?.(next.map(({ file }) => file));
    console.info("[批图匠] 图片已加入上传区", { label, count: additions.length });
  }

  /** 删除指定预览，并立即释放浏览器内存。 */
  function removePreview(url: string) {
    URL.revokeObjectURL(url);
    const next = previews.filter((preview) => preview.url !== url);
    setPreviews(next);
    onChange?.(next.map((preview) => preview.url));
    onFilesChange?.(next.map((preview) => preview.file));
  }

  return (
    <section className={styles.uploadSection}>
      <div className={styles.fieldLabel}>{label}</div>
      <label
        className={styles.uploadZone}
        htmlFor={inputId}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files)); }}
      >
        <input
          id={inputId}
          aria-label={label}
          accept={acceptedTypes.join(",")}
          multiple
          type="file"
          onChange={(event) => addFiles(Array.from(event.target.files ?? []))}
        />
        <UploadCloud size={28} />
        <span>将图片拖到此处，或 <strong>点击上传</strong>（限 10 张）</span>
        <small>支持 {acceptedTypes.map((type) => type.split("/")[1]).join("、")}，单张不超过 {Math.round(maxFileSize / 1024 / 1024)}MB</small>
      </label>
      {error && <p className={styles.errorText} role="alert">{error}</p>}
      {previews.length > 0 && (
        <div className={styles.previewGrid}>
          {previews.map(({ file, url }) => (
            <figure key={url}>
              <img src={url} alt={file.name} />
              <button type="button" aria-label={`删除 ${file.name}`} onClick={() => removePreview(url)}><Trash2 size={15} /></button>
            </figure>
          ))}
          {previews.length < 10 && <div className={styles.previewAdd}><ImagePlus size={20} /><span>{previews.length}/10</span></div>}
        </div>
      )}
    </section>
  );
}
