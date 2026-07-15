import { Sparkles } from "lucide-react";

/** 批图匠品牌标识，仅使用文字和矢量图标，不复制原站私有图片。 */
export function BrandMark() {
  return (
    <div className="brand-mark" aria-label="批图匠 AI">
      <span className="brand-mark__icon"><Sparkles size={18} strokeWidth={2.4} /></span>
      <strong>批图匠</strong><em>AI</em>
    </div>
  );
}
