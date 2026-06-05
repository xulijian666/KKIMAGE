import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExpertModal } from "./ExpertModal";

export interface ReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
}

interface GeneratePanelProps {
  onGenerate: (
    prompt: string,
    model: string,
    size: string,
    quality: string,
    inputImages: string[]
  ) => void;
  isGenerating: boolean;
  disabled?: boolean;
  activeImagePath?: string | null;
  referenceImages: ReferenceImage[];
  onAddReferenceImages: (images: ReferenceImage[]) => void;
  onRemoveReferenceImage: (id: string) => void;
  onClearReferenceImages: () => void;
  onPreviewImage: (url: string, name: string) => void;
  mode: "generate" | "edit";
  onModeChange: (newMode: "generate" | "edit") => void;
}

const MODEL = import.meta.env.VITE_MODEL || "gpt-image-2";
const MAX_REFERENCE_IMAGES = 6;

const SIZES = [
  { value: "1024x1024", label: "1:1 1024" },
  { value: "1536x1024", label: "3:2 1536" },
  { value: "1024x1536", label: "2:3 1536" },
  { value: "2048x2048", label: "1:1 2048" },
  { value: "3840x2160", label: "16:9 4K" },
  { value: "auto", label: "自动" },
];

const QUALITIES = [
  { value: "auto", label: "自动" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
];

const IconSparkles = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
    <path d="M5 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" />
    <path d="M19 14l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5L17 16.5l1.5-.5.5-1.5z" />
  </svg>
);

const IconImagePlus = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 15l-5-5L5 21" />
    <path d="M16 3v6" />
    <path d="M13 6h6" />
  </svg>
);

const IconX = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const DEFAULT_BLUE_PROMPT = `绘制一个标准的专业图表，整体设计要求与微软 VISIO 风格保持高度一致。

【核心排版逻辑与连线规范】
1. 必须完全、精准地遵循输入的 Mermaid 代码所定义的节点、顺序、交互角色和连线逻辑，确保最终渲染 of the 图示连线、拓扑关系、流转路径与输入的 Mermaid 源码完全一致，绝无遗漏、多余、反向或篡改。
2. 如果是流程图：
   - 连接线必须是水平或垂直的直角折线（Orthogonal lines），严禁斜线、弧线或交叉重叠的无序曲线。
   - 线条末端必须有清晰锐利的标准指向箭头，确保指向正确的下游节点。
   - 起止节点统一为圆角矩形，普通步骤为直角矩形，条件判断为标准菱形。
3. 如果是时序图：
   - 参与者/对象方框在顶部横向排齐对齐，下方延伸出垂直虚线作为生命线（Lifelines）。
   - 交互消息传递线使用带箭头的水平线（实线为请求/调用，虚线为返回/答复），线段必须完全水平，严禁倾斜。
   - 生命线上的激活矩形块（Activation boxes）定位必须精准，长度和时间范围严格吻合。
   
【文字与可读性要求】
1. 所有文本内容（包括节点文字、连线标签、参与者名称）必须极其清晰、高分辨率、高对比度、极其易读。
2. 严禁出现拼写混乱、字符丢失、模糊、边缘毛糙或文字与节点/连线重叠的情况。
3. 文字使用标准的扁平化无衬线系统字体（如 Arial 或 Segoe UI），在节点或线条上方居中对齐，大小适中。

【色彩与平面视觉风格】
1. 呈现极简、高端的 2D 扁平图表风格，严禁任何三维 3D 渲染、写实插图或杂乱的渐变阴影。
2. 背景必须是纯白底，提供最干净的阅读体验。
3. 节点填充颜色使用低饱和度的经典 VISIO 浅蓝色（例如 HSL 210, 80%, 90%），边框为深蓝色，文字为黑色或深灰色。
4. 严禁使用任何 Emoji 表情符号或无意义的图标点缀。`;

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function GeneratePanel({
  onGenerate,
  isGenerating,
  disabled,
  activeImagePath,
  referenceImages,
  onAddReferenceImages,
  onRemoveReferenceImage,
  onClearReferenceImages,
  onPreviewImage,
  mode,
  onModeChange,
}: GeneratePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(() => localStorage.getItem("kkimage_size") || "1024x1024");
  const [quality, setQuality] = useState(() => localStorage.getItem("kkimage_quality") || "auto");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 模式状态 (生成模式 / 修改模式)
  const handleModeChange = (val: "generate" | "edit") => {
    onModeChange(val);
  };

  // 专家状态
  const [activeExpert, setActiveExpert] = useState<"none" | "visio">(() => {
    return (localStorage.getItem("kkimage_active_expert") as "none" | "visio") || "none";
  });
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [expertConfig, setExpertConfig] = useState(() => {
    const saved = localStorage.getItem("kkimage_expert_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {}
    }
    return {
      activeStyleId: "blue",
      styles: [],
    };
  });

  const handleSaveExpertConfig = (newConfig: typeof expertConfig) => {
    setExpertConfig(newConfig);
    localStorage.setItem("kkimage_expert_config", JSON.stringify(newConfig));
  };

  const handleActiveExpertChange = (val: "none" | "visio") => {
    setActiveExpert(val);
    localStorage.setItem("kkimage_active_expert", val);
  };

  const appendReferenceImages = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0 || isGenerating || disabled) return;

    const freeSlots = Math.max(0, MAX_REFERENCE_IMAGES - referenceImages.length);
    const nextFiles = imageFiles.slice(0, freeSlots);
    const nextImages = await Promise.all(
      nextFiles.map(async (file) => ({
        id: createId(),
        name: file.name || "粘贴图片",
        dataUrl: await readFileAsDataUrl(file),
      }))
    );

    onAddReferenceImages(nextImages);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files);
    if (files.some((file) => file.type.startsWith("image/"))) {
      e.preventDefault();
      appendReferenceImages(files);
    }
  };

  const handlePickImage = async () => {
    if (isGenerating || disabled || referenceImages.length >= MAX_REFERENCE_IMAGES) return;
    const imagePath = await invoke<string | null>("select_image_file");
    if (!imagePath) return;

    const dataUrl = await invoke<string>("get_image_data_url", { imagePath });
    onAddReferenceImages([
      {
        id: createId(),
        name: imagePath.split(/[\\/]/).pop() || "参考图",
        dataUrl,
      },
    ]);
  };

  const handleUseCurrentImage = async () => {
    if (!activeImagePath || isGenerating || disabled || referenceImages.length >= MAX_REFERENCE_IMAGES) return;
    const dataUrl = await invoke<string>("get_image_data_url", { imagePath: activeImagePath });
    onAddReferenceImages([{ id: createId(), name: "当前图", dataUrl }]);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating || disabled) return;
    if (mode === "edit" && referenceImages.length === 0) return;

    localStorage.setItem("kkimage_size", size);
    localStorage.setItem("kkimage_quality", quality);

    let finalPrompt = trimmed;

    if (mode === "edit") {
      finalPrompt = `【图像局部修改模式指令】
您现在的任务是根据用户的修改要求对输入的底图进行精确的局部调整。
请严格遵循以下规则，这是最关键的要求：
1. 【精确修改】：只修改用户指出的特定区域或要求调整的内容。如果是带红色矩形、圆形或自由笔迹标记的图像，请精确聚焦在这些标记指示的修改区域。
2. 【像素保持】：严禁改动图中任何其他未被指出要修改的区域。保持原图的背景、布局、原始字符、连线、图表结构、比例大小和配色方案与原图 100% 完全一致。
3. 【风格融入】：修改后产生的新元素或文字在字体、颜色、大小、线条粗细和整体平面图表风格上必须与原图无缝融合，不留修剪痕迹。

用户的具体修改指令如下：
${trimmed}`;
    } else if (activeExpert === "visio") {
      const activeStyle = expertConfig.styles?.find(
        (s: any) => s.id === expertConfig.activeStyleId
      ) || { prompt: DEFAULT_BLUE_PROMPT };

      finalPrompt = `${activeStyle.prompt}

要绘制的 Mermaid 结构与图形关系描述为：
${trimmed}`;
    }

    onGenerate(
      finalPrompt,
      MODEL,
      size,
      quality,
      referenceImages.map((image) => image.dataUrl)
    );
    setPrompt("");
    onClearReferenceImages();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="generate-panel">
      <div className="prompt-area" style={{ display: "flex", flexDirection: "column" }}>
        {/* Mode Switcher Tabs */}
        <div
          className="mode-tabs"
          style={{
            display: "flex",
            gap: "2px",
            borderBottom: "1px solid var(--border-color)",
            padding: "4px 8px",
            background: "var(--bg-sidebar)",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            className={`mode-tab ${mode === "generate" ? "active" : ""}`}
            onClick={() => handleModeChange("generate")}
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: mode === "generate" ? "var(--bg-active-item)" : "transparent",
              color: mode === "generate" ? "var(--text-active-item)" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            生成模式 (New)
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === "edit" ? "active" : ""}`}
            onClick={() => handleModeChange("edit")}
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: mode === "edit" ? "var(--bg-active-item)" : "transparent",
              color: mode === "edit" ? "var(--text-active-item)" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            修改模式 (Edit)
          </button>
        </div>

        {referenceImages.length > 0 && (
          <div className="reference-strip">
            {referenceImages.map((image) => (
              <div
                className="reference-thumb"
                key={image.id}
                title={image.name}
                onClick={() => onPreviewImage(image.dataUrl, image.name)}
                style={{ cursor: "pointer" }}
              >
                <img src={image.dataUrl} alt="" />
                <button
                  className="reference-remove"
                  type="button"
                  title="移除参考图"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveReferenceImage(image.id);
                  }}
                  disabled={isGenerating}
                >
                  <IconX />
                </button>
              </div>
            ))}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="prompt-input"
          placeholder={
            disabled
              ? "先在左侧选择一个会话..."
              : mode === "edit"
              ? "【修改模式】请先在下方添加或引用修改底图，然后在此输入具体的修改要求（可在上方参考图缩略图或点击聊天流中的大图打开标注面板进行画笔或框选标记）..."
              : activeExpert !== "none"
              ? "请输入或粘贴 Mermaid 代码（例如：graph TD 或 sequenceDiagram）进行图表绘制，支持添加其它微调描述..."
              : "描述你想生成或修改的图片，支持直接粘贴图片..."
          }
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={3}
          disabled={isGenerating || disabled}
        />
      </div>

      <div className="params-bar">
        <div className="params-left">
          <button
            className="btn-tool"
            type="button"
            title="添加参考图"
            onClick={handlePickImage}
            disabled={isGenerating || disabled || referenceImages.length >= MAX_REFERENCE_IMAGES}
          >
            <IconImagePlus />
            <span>参考图</span>
          </button>

          {activeImagePath && (
            <button
              className="btn-tool"
              type="button"
              title="把当前结果作为参考图继续修改"
              onClick={handleUseCurrentImage}
              disabled={isGenerating || disabled || referenceImages.length >= MAX_REFERENCE_IMAGES}
            >
              <IconSparkles />
              <span>引用当前图</span>
            </button>
          )}

          <div className="param-group">
            <label className="param-label">尺寸</label>
            <select
              className="param-select"
              value={size}
              onChange={(e) => setSize(e.target.value)}
              disabled={isGenerating || disabled}
            >
              {SIZES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="param-group">
            <label className="param-label">质量</label>
            <select
              className="param-select"
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              disabled={isGenerating || disabled}
            >
              {QUALITIES.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="params-right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {mode === "edit" && referenceImages.length === 0 && (
            <span style={{ fontSize: "12px", color: "var(--color-red)", fontWeight: 500, marginRight: "4px" }}>
              ⚠️ 请先添加修改底图
            </span>
          )}

          {mode === "generate" && (
            <>
              <select
                className="param-select expert-select"
                value={activeExpert}
                onChange={(e) => handleActiveExpertChange(e.target.value as "none" | "visio")}
                disabled={isGenerating || disabled}
                style={{ height: "32px", fontSize: "12px" }}
              >
                <option value="none">无专家</option>
                <option value="visio">VISIO图专家</option>
              </select>

              <button
                className={`btn-expert ${activeExpert !== "none" ? "active" : ""}`}
                type="button"
                onClick={() => setShowExpertModal(true)}
                disabled={disabled}
                style={{
                  height: "32px",
                  padding: "0 12px",
                  fontSize: "12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  background: activeExpert !== "none" ? "var(--bg-active-item)" : "var(--bg-main)",
                  color: activeExpert !== "none" ? "var(--text-active-item)" : "var(--text-primary)",
                  borderColor: activeExpert !== "none" ? "var(--color-primary)" : "var(--border-color)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontWeight: 500,
                }}
              >
                <span>专家配置</span>
              </button>
            </>
          )}

          <button
            className={`btn-generate ${isGenerating ? "generating" : ""}`}
            onClick={handleSubmit}
            disabled={
              !prompt.trim() ||
              (mode === "edit" && referenceImages.length === 0) ||
              isGenerating ||
              disabled
            }
          >
            {isGenerating ? (
              <>
                <span className="spinner" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <IconSparkles />
                <span>生成</span>
              </>
            )}
          </button>
        </div>
      </div>

      <ExpertModal
        isOpen={showExpertModal}
        onClose={() => setShowExpertModal(false)}
        config={expertConfig}
        onSave={handleSaveExpertConfig}
      />
    </div>
  );
}

