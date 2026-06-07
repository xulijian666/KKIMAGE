import { type ComponentType } from "react";
import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ExpertModal, type ExpertDef, loadExperts, saveExperts, getExpertById } from "./ExpertModal";
import { debugLog, exportLogsToFile, flushLogs } from "../utils/helpers";

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
  ) => Promise<void>;
  isGenerating: boolean;
  disabled?: boolean;
  activeImagePath?: string | null;
  referenceImages: ReferenceImage[];
  onAddReferenceImages: (images: ReferenceImage[]) => void;
  onRemoveReferenceImage: (id: string) => void;
  onClearReferenceImages: () => void;
  onPreviewImage: (url: string, name: string) => void;
  mode: "generate" | "edit" | "ai";
  onModeChange: (newMode: "generate" | "edit" | "ai") => void;
  editOriginal: ReferenceImage | null;
  editAnnotated: ReferenceImage | null;
  onSetEditOriginal: (image: ReferenceImage | null) => void;
  onClearEditAnnotated: () => void;
  reloadMermaidCode?: string | null;
  onReloadMermaidConsumed?: () => void;
  openExpertConfig?: boolean;
  onExpertConfigConsumed?: () => void;
}

const MODEL = import.meta.env.VITE_MODEL || "gpt-image-2";
const MAX_REFERENCE_IMAGES = 6;



const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const IconEraser = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
    <path d="M22 21H7" />
    <path d="m5 11 9 9" />
  </svg>
);

const IconImageOff = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="2" y1="2" x2="22" y2="22" />
    <path d="M10.41 10.41a2 2 0 1 1-2.83-2.83" />
    <path d="M13.5 13.5 17 17" />
    <path d="M3 5v14a2 2 0 0 0 2 2h14" />
    <path d="M21 12V5a2 2 0 0 0-2-2H9" />
    <path d="m3 3 18 18" />
  </svg>
);

const IconZoomIn = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
    <path d="M11 8v6" />
    <path d="M8 11h6" />
  </svg>
);

const IconAlertTriangle = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const EDIT_TASK_PRESETS: { id: string; label: string; Icon: ComponentType; prompt: string }[] = [
  {
    id: "none",
    label: "自定义",
    Icon: IconEdit,
    prompt: "",
  },
  {
    id: "remove-watermark",
    label: "去水印",
    Icon: IconEraser,
    prompt: `请去除图像中的所有水印，包括但不限于：文字水印、Logo 水印、半透明叠加水印、重复平铺水印。

【处理要求】
1. 自动识别并精准定位图像中所有水印元素（包括半透明、低对比度、融入背景的水印）。
2. 完整去除水印覆盖区域，使用与周围环境一致的纹理、颜色和图案进行自然填充（Inpainting）。
3. 确保去除后区域与周围画面无缝融合，无明显的涂抹痕迹、色块差异或纹理断裂。
4. 保持图像其余所有区域的像素完全不变，不引入任何伪影或质量损失。
5. 如果图像中存在标注参考图（带有红色矩形或圆形标记），请优先处理标注区域内及紧邻区域的水印。
6. 输出结果必须保持原始分辨率和画质。`,
  },
  {
    id: "remove-bg",
    label: "去背景",
    Icon: IconImageOff,
    prompt: `请精准去除图像背景，保留完整的前景主体。

【处理要求】
1. 精准识别前景主体的完整轮廓，包括边缘细节（发丝、羽毛、透明物体等）。
2. 完全去除背景区域。
3. 用纯白色填充原背景区域（如果需要透明背景请在追加描述中说明）。
4. 保持前景主体的所有细节、颜色和质感完全不变。`,
  },
  {
    id: "enhance",
    label: "增强画质",
    Icon: IconZoomIn,
    prompt: `请对图像进行全面的画质增强处理。

【处理要求】
1. 提升图像分辨率和整体清晰度。
2. 优化色彩饱和度和对比度，使画面更鲜明生动。
3. 降低噪点，提高信噪比。
4. 增强细节纹理表现力。
5. 保持图像内容的完整性和自然感，不过度锐化或失真。`,
  },
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
  editOriginal,
  editAnnotated,
  onSetEditOriginal,
  onClearEditAnnotated,
  reloadMermaidCode,
  onReloadMermaidConsumed,
  openExpertConfig,
  onExpertConfigConsumed,
}: GeneratePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [size] = useState("auto");
  const [quality] = useState("auto");
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editTask, setEditTask] = useState<string>(() => {
    return localStorage.getItem("kkimage_edit_task") || "none";
  });
  const [aiDescription, setAiDescription] = useState("");
  const [isMermaidGenerating, setIsMermaidGenerating] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 模式状态 (生成模式 / 修改模式 / AI生成Mermaid)
  const handleModeChange = (val: "generate" | "edit" | "ai") => {
    onModeChange(val);
  };

  // Watch for reload Mermaid code from ChatWorkspace
  useEffect(() => {
    if (reloadMermaidCode) {
      setPrompt(reloadMermaidCode);
      // Auto-select VISIO expert if none selected
      if (activeExpert === "none") {
        handleActiveExpertChange("visio");
      }
      onReloadMermaidConsumed?.();
      textareaRef.current?.focus();
    }
  }, [reloadMermaidCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Watch for openExpertConfig from titlebar
  useEffect(() => {
    if (openExpertConfig) {
      setShowExpertModal(true);
      onExpertConfigConsumed?.();
    }
  }, [openExpertConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // 快捷任务切换
  const handleTaskChange = (taskId: string) => {
    setEditTask(taskId);
    localStorage.setItem("kkimage_edit_task", taskId);
  };

  // 专家状态
  const [activeExpert, setActiveExpert] = useState<string>(() => {
    return localStorage.getItem("kkimage_active_expert") || "none";
  });
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [experts, setExperts] = useState<ExpertDef[]>(() => loadExperts());
  const [activeStyleId, setActiveStyleId] = useState<string>(() => {
    return localStorage.getItem("kkimage_active_style_id") || "classic-blue";
  });

  // Verify and reset invalid activeExpert/activeStyleId loaded from previous storage
  useEffect(() => {
    if (activeExpert !== "none" && !experts.some((e) => e.id === activeExpert)) {
      setActiveExpert("flowchart");
      localStorage.setItem("kkimage_active_expert", "flowchart");
      const flowchartExpert = experts.find((e) => e.id === "flowchart");
      if (flowchartExpert && flowchartExpert.styles.length > 0) {
        setActiveStyleId(flowchartExpert.styles[0].id);
        localStorage.setItem("kkimage_active_style_id", flowchartExpert.styles[0].id);
      }
    } else if (activeExpert !== "none") {
      const expert = experts.find((e) => e.id === activeExpert);
      if (expert && !expert.styles.some((s) => s.id === activeStyleId)) {
        if (expert.styles.length > 0) {
          setActiveStyleId(expert.styles[0].id);
          localStorage.setItem("kkimage_active_style_id", expert.styles[0].id);
        }
      }
    }
  }, [experts, activeExpert, activeStyleId]);

  const handleSaveExperts = (updatedExperts: ExpertDef[], newActiveStyleId: string) => {
    setExperts(updatedExperts);
    saveExperts(updatedExperts);
    if (newActiveStyleId) {
      setActiveStyleId(newActiveStyleId);
      localStorage.setItem("kkimage_active_style_id", newActiveStyleId);
    }
  };

  const handleActiveExpertChange = (val: string) => {
    setActiveExpert(val);
    localStorage.setItem("kkimage_active_expert", val);
    // Auto-select first style of new expert
    const expert = getExpertById(experts, val);
    if (expert && expert.styles.length > 0) {
      const firstStyleId = expert.styles[0].id;
      setActiveStyleId(firstStyleId);
      localStorage.setItem("kkimage_active_style_id", firstStyleId);
    }
  };

  const appendReferenceImages = async (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0 || isGenerating || disabled) return;

    if (mode === "edit") {
      // In edit mode, pasted image goes to original slot
      if (!editOriginal && imageFiles.length > 0) {
        const file = imageFiles[0];
        onSetEditOriginal({
          id: createId(),
          name: file.name || "粘贴图片",
          dataUrl: await readFileAsDataUrl(file),
        });
      }
      return;
    }

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
    if (isGenerating || disabled) return;
    if (mode !== "edit" && referenceImages.length >= MAX_REFERENCE_IMAGES) return;

    const imagePath = await invoke<string | null>("select_image_file");
    if (!imagePath) return;

    const dataUrl = await invoke<string>("get_image_data_url", { imagePath });
    const image: ReferenceImage = {
      id: createId(),
      name: imagePath.split(/[\\/]/).pop() || "参考图",
      dataUrl,
    };

    if (mode === "edit") {
      onSetEditOriginal(image);
    } else {
      onAddReferenceImages([image]);
    }
  };

  const handleUseCurrentImage = async () => {
    if (!activeImagePath || isGenerating || disabled) return;
    if (mode !== "edit" && referenceImages.length >= MAX_REFERENCE_IMAGES) return;

    const dataUrl = await invoke<string>("get_image_data_url", { imagePath: activeImagePath });
    const image: ReferenceImage = { id: createId(), name: "当前图", dataUrl };

    if (mode === "edit") {
      onSetEditOriginal(image);
    } else {
      onAddReferenceImages([image]);
    }
    textareaRef.current?.focus();
  };

  const handleSubmit = async () => {
    // Immediate console.log for debugging even if debugLog fails
    console.log("[SUBMIT] handleSubmit triggered at", new Date().toISOString());
    debugLog("Submit", "handleSubmit called", {
      prompt: prompt.trim().slice(0, 50),
      mode,
      isGenerating,
      disabled,
      editOriginal: !!editOriginal,
      editAnnotated: !!editAnnotated,
      referenceImagesCount: referenceImages.length,
    });
    flushLogs();

    const trimmed = prompt.trim();
    // Determine if we can proceed without typed text (quick task selected)
    const activeTaskPreset = mode === "edit" && editTask !== "none"
      ? EDIT_TASK_PRESETS.find((t) => t.id === editTask)
      : null;

    if (!trimmed && !activeTaskPreset) {
      debugLog("Submit", "EARLY RETURN: prompt is empty and no quick task selected");
      flushLogs();
      return;
    }
    if (isGenerating) {
      debugLog("Submit", "EARLY RETURN: already generating");
      flushLogs();
      return;
    }
    if (disabled) {
      debugLog("Submit", "EARLY RETURN: panel disabled (no session?)");
      flushLogs();
      return;
    }
    if (mode === "edit" && !editOriginal) {
      debugLog("Submit", "EARLY RETURN: edit mode but no original image");
      flushLogs();
      return;
    }



    let finalPrompt = trimmed;
    let inputImages: string[] = [];

    if (mode === "edit") {
      const hasAnnotated = !!editAnnotated;
      inputImages = [editOriginal!.dataUrl];
      if (hasAnnotated) inputImages.push(editAnnotated!.dataUrl);
      debugLog("Submit", `Edit mode: ${inputImages.length} image(s), annotated=${hasAnnotated}`, {
        originalSize: editOriginal!.dataUrl.length,
        annotatedSize: hasAnnotated ? editAnnotated!.dataUrl.length : 0,
      });

      let imageContextBlock = "";
      if (hasAnnotated) {
        imageContextBlock = `【输入图像说明】
- 第 1 张图像是"原始底图"（未标注的干净原图），代表需要被修改的原始画面。
- 第 2 张图像是"标注参考图"（带有红色矩形、圆形或自由笔迹标记），标记指示了需要修改的具体区域。
请优先以标注参考图中标记的区域作为修改目标，同时参考原始底图保持未修改区域的像素完全一致。\n`;
      } else {
        imageContextBlock = `【输入图像说明】
- 唯一的图像是"原始底图"，代表需要被修改的原始画面。用户没有提供标注图，请根据文字指令自行判断修改区域。\n`;
      }

      // Build the user instruction portion
      let userInstruction = "";
      if (activeTaskPreset && trimmed) {
        // Task preset + user's additional description
        userInstruction = `${activeTaskPreset.prompt}\n\n用户追加的具体要求：\n${trimmed}`;
      } else if (activeTaskPreset) {
        // Task preset only (no user text)
        userInstruction = activeTaskPreset.prompt;
      } else {
        // Manual text only
        userInstruction = trimmed;
      }

      finalPrompt = `【图像局部修改模式指令】
您现在的任务是根据用户的修改要求对输入的底图进行精确的局部调整。
${imageContextBlock}
请严格遵循以下规则：
1. 【精确修改】：只修改用户指出的特定区域或要求调整的内容。
2. 【像素保持】：严禁改动图中任何其他未被指出要修改的区域。保持原图的背景、布局、原始字符、连线、图表结构、比例大小和配色方案 100% 一致。
3. 【风格融入】：修改后产生的新元素或文字必须与原图无缝融合。

用户的具体修改指令如下：
${userInstruction}`;
    } else if (activeExpert !== "none") {
      const expert = getExpertById(experts, activeExpert);
      const activeStyle = expert?.styles.find(
        (s) => s.id === activeStyleId
      ) || expert?.styles[0];

      if (expert && activeStyle) {
        finalPrompt = `${expert.basePrompt}

【设计流派与色彩规范】
${activeStyle.prompt}

要绘制的 Mermaid 结构与图形关系描述为：
${trimmed}`;
      } else if (activeStyle) {
        finalPrompt = `${activeStyle.prompt}

要绘制的 Mermaid 结构与图形关系描述为：
${trimmed}`;
      } else {
        finalPrompt = trimmed;
      }

      inputImages = referenceImages.map((image) => image.dataUrl);
      debugLog("Submit", `Generate mode (expert=${activeExpert}): ${inputImages.length} ref image(s)`);
    } else {
      inputImages = referenceImages.map((image) => image.dataUrl);
      debugLog("Submit", `Generate mode: ${inputImages.length} ref image(s)`);
    }

    debugLog("Submit", "Calling onGenerate...", {
      promptLength: finalPrompt.length,
      imageCount: inputImages.length,
      totalImageBytes: inputImages.reduce((sum, img) => sum + img.length, 0),
      model: MODEL,
      size,
      quality,
    });
    flushLogs();

    try {
      setGenerateError(null);
      setIsSubmitting(true);
      debugLog("Submit", "About to call await onGenerate()");
      flushLogs();
      await onGenerate(finalPrompt, MODEL, size, quality, inputImages);
      debugLog("Submit", "onGenerate resolved successfully, clearing prompt");
      flushLogs();
      setPrompt("");
      if (mode === "edit") {
        setEditTask("none");
      } else {
        onClearReferenceImages();
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      debugLog("Submit", "onGenerate FAILED", errMsg);
      flushLogs();
      setGenerateError(errMsg);
      console.error("生成失败:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleGenerateMermaid = async () => {
    const desc = aiDescription.trim();
    if (!desc || isMermaidGenerating) return;
    setIsMermaidGenerating(true);
    setGenerateError(null);
    try {
      debugLog("AI", "Generating Mermaid from description", { descLen: desc.length });
      flushLogs();
      const mermaidCode = await invoke<string>("generate_mermaid", { description: desc });
      debugLog("AI", "Mermaid generated", { codeLen: mermaidCode.length });
      flushLogs();
      setPrompt(mermaidCode);
      // Auto-select VISIO expert if none selected
      if (activeExpert === "none") {
        handleActiveExpertChange("visio");
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      debugLog("AI", "Mermaid generation failed", errMsg);
      flushLogs();
      setGenerateError(errMsg);
    } finally {
      setIsMermaidGenerating(false);
    }
  };

  return (
    <div className="generate-panel">
      {/* Edit mode: dual-slot image layout — ABOVE tabs to prevent layout shift */}
      {mode === "edit" && (
        <div className="edit-slots">
          {/* Slot 1: Original Image */}
          <div className="edit-slot edit-slot-original">
            <div className="edit-slot-label">
              <span className="edit-slot-step">Step 1</span>
              <span className="edit-slot-title">原图</span>
            </div>
            {editOriginal ? (
              <div className="edit-slot-image">
                <img
                  src={editOriginal.dataUrl}
                  alt="原图"
                  onClick={() => onPreviewImage(editOriginal.dataUrl, "原图")}
                  style={{ cursor: "pointer" }}
                />
                <button
                  className="edit-slot-annotate"
                  type="button"
                  title="打开标注面板"
                  onClick={() => onPreviewImage(editOriginal.dataUrl, "标注原图")}
                  disabled={isGenerating}
                >
                  标注
                </button>
                <button
                  className="edit-slot-remove"
                  type="button"
                  title="移除原图"
                  onClick={() => onSetEditOriginal(null)}
                  disabled={isGenerating}
                >
                  <IconX />
                </button>
              </div>
            ) : (
              <div
                className="edit-slot-empty"
                onClick={() => { if (!isGenerating && !disabled) handlePickImage(); }}
              >
                <IconImagePlus />
                <span>点击添加或粘贴底图</span>
              </div>
            )}
          </div>

          {/* Arrow between slots */}
          <div className="edit-slot-arrow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>

          {/* Slot 2: Annotated Image */}
          <div className="edit-slot edit-slot-annotated">
            <div className="edit-slot-label">
              <span className="edit-slot-step">Step 2</span>
              <span className="edit-slot-title">标注图</span>
              <span className="edit-slot-optional">可选</span>
            </div>
            {editAnnotated ? (
              <div className="edit-slot-image">
                <img
                  src={editAnnotated.dataUrl}
                  alt="标注图"
                  onClick={() => onPreviewImage(editAnnotated.dataUrl, "标注图")}
                  style={{ cursor: "pointer" }}
                />
                <button
                  className="edit-slot-remove"
                  type="button"
                  title="移除标注图"
                  onClick={onClearEditAnnotated}
                  disabled={isGenerating}
                >
                  <IconX />
                </button>
              </div>
            ) : (
              <div className={`edit-slot-empty ${!editOriginal ? "edit-slot-empty-disabled" : ""}`}>
                <span>{editOriginal ? "点击左侧\u2018标注\u2019按钮进行标注" : "请先添加原图"}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI mode: natural language input — ABOVE tabs */}
      {mode === "ai" && (
        <div className="ai-mode-section">
          <textarea
            className="prompt-input ai-description-input"
            placeholder="用自然语言描述你想画的图...（例如：用户登录流程，包含输入账号密码、验证、登录成功/失败分支）"
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            rows={3}
            disabled={isGenerating || isMermaidGenerating || disabled}
          />
          <button
            type="button"
            className="btn-generate-mermaid"
            onClick={handleGenerateMermaid}
            disabled={!aiDescription.trim() || isMermaidGenerating || isGenerating || disabled}
          >
            {isMermaidGenerating ? (
              <>
                <span className="spinner" />
                <span>AI 生成中...</span>
              </>
            ) : (
              <>
                <IconSparkles />
                <span>AI 生成 Mermaid</span>
              </>
            )}
          </button>
          {prompt.trim() && (
            <div className="ai-mode-hint">
              Mermaid 代码已生成，可编辑后点击“生成”出图
            </div>
          )}
        </div>
      )}

      {/* Step hint for edit mode — above tabs */}
      {mode === "edit" && (
        <div className="edit-step-hint" style={{ padding: "4px 16px 0" }}>
          {!editOriginal
            ? "Step 1: 请添加需要处理的图片"
            : editTask !== "none"
            ? `已选「${EDIT_TASK_PRESETS.find(t => t.id === editTask)?.label}」— 用"标注"框选区域可提升精准度，或直接点生成`
            : !prompt.trim()
            ? "Step 2: 可选标注区域，然后在此输入修改要求"
            : "Step 3: 点击\u2018生成\u2019提交修改"}
        </div>
      )}

      {/* Quick task presets for edit mode — above tabs */}
      {mode === "edit" && editOriginal && (
        <div className="edit-task-presets" style={{ padding: "4px 16px 0" }}>
          <span className="edit-task-label">快捷任务:</span>
          {EDIT_TASK_PRESETS.map((task) => (
            <button
              key={task.id}
              type="button"
              className={`edit-task-btn ${editTask === task.id ? "active" : ""}`}
              onClick={() => handleTaskChange(task.id)}
            >
              <task.Icon />
              <span>{task.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Generate / AI mode: flat reference strip — above tabs */}
      {(mode === "generate" || mode === "ai") && referenceImages.length > 0 && (
        <div className="reference-strip" style={{ padding: "8px 16px 0", margin: 0 }}>
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
          <button
            type="button"
            className={`mode-tab ${mode === "ai" ? "active" : ""}`}
            onClick={() => handleModeChange("ai")}
            style={{
              padding: "4px 12px",
              fontSize: "12px",
              fontWeight: 500,
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              background: mode === "ai" ? "var(--bg-active-item)" : "transparent",
              color: mode === "ai" ? "var(--text-active-item)" : "var(--text-secondary)",
              transition: "all 0.15s ease",
            }}
          >
            AI 生成 Mermaid
          </button>

          {/* Dev mode: export logs button */}
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={exportLogsToFile}
              title={`导出调试日志 (文件: %APPDATA%\KKIMAGE\debug.log)`}
              style={{
                marginLeft: "auto",
                padding: "2px 8px",
                fontSize: "11px",
                borderRadius: "4px",
                border: "1px solid var(--border-color)",
                background: "transparent",
                color: "var(--text-secondary)",
                cursor: "pointer",
              }}
            >
              日志
            </button>
          )}
      </div>

      <div className="prompt-area" style={{ display: "flex", flexDirection: "column" }}>
        <textarea
          ref={textareaRef}
          className="prompt-input"
          placeholder={
            disabled
              ? "先在左侧选择一个会话..."
              : mode === "ai"
              ? "在此编辑 Mermaid 代码（由上方 AI 生成，或直接粘贴自己的 Mermaid 代码）..."
              : mode === "edit"
              ? editOriginal
                ? editTask !== "none"
                  ? `已选择「${EDIT_TASK_PRESETS.find(t => t.id === editTask)?.label}」，可追加额外描述（可选）...`
                  : "在此输入具体的修改要求..."
                : "请先添加原图，然后在此输入修改要求..."
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

      {/* Error banner */}
      {generateError && (
        <div
          className="generate-error-banner"
          style={{
            margin: "0 12px",
            padding: "6px 10px",
            background: "rgba(239, 68, 68, 0.12)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "6px",
            fontSize: "12px",
            color: "var(--color-red)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ flex: 1, wordBreak: "break-word", display: "flex", alignItems: "center", gap: "4px" }}>
            <IconAlertTriangle />
            生成失败: {generateError}
          </span>
          <button
            type="button"
            onClick={() => setGenerateError(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-secondary)",
              cursor: "pointer",
              padding: "0 2px",
              fontSize: "14px",
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>
      )}

      <div className="params-bar">
        <div className="params-left">
          <button
            className="btn-tool"
            type="button"
            title={mode === "edit" ? "添加原图" : "添加参考图"}
            onClick={handlePickImage}
            disabled={isGenerating || disabled || (mode === "generate" && referenceImages.length >= MAX_REFERENCE_IMAGES)}
          >
            <IconImagePlus />
            <span>{mode === "edit" ? "原图" : "参考图"}</span>
          </button>

          {activeImagePath && (
            <button
              className="btn-tool"
              type="button"
              title={mode === "edit" ? "把当前结果作为原图继续修改" : "把当前结果作为参考图继续修改"}
              onClick={handleUseCurrentImage}
              disabled={isGenerating || disabled || (mode === "generate" && referenceImages.length >= MAX_REFERENCE_IMAGES)}
            >
              <IconSparkles />
              <span>引用当前图</span>
            </button>
          )}
        </div>

        <div className="params-right" style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {mode === "edit" && !editOriginal && (
            <span style={{ fontSize: "12px", color: "var(--color-red)", fontWeight: 500, marginRight: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
              <IconAlertTriangle />
              请先添加修改底图
            </span>
          )}

          {mode !== "edit" && (
            <>
              <select
                className="param-select expert-select"
                value={activeExpert}
                onChange={(e) => handleActiveExpertChange(e.target.value)}
                disabled={isGenerating || disabled}
                style={{ height: "32px", fontSize: "12px" }}
              >
                <option value="none">无专家</option>
                {experts.map((expert) => (
                  <option key={expert.id} value={expert.id}>{expert.name}</option>
                ))}
              </select>

              {/* Design Flow dropdown */}
              {activeExpert !== "none" && (() => {
                const expert = getExpertById(experts, activeExpert);
                if (!expert || expert.styles.length <= 1) return null;
                return (
                  <select
                    className="param-select expert-select"
                    value={activeStyleId}
                    onChange={(e) => {
                       setActiveStyleId(e.target.value);
                       localStorage.setItem("kkimage_active_style_id", e.target.value);
                    }}
                    disabled={isGenerating || disabled}
                    style={{ height: "32px", fontSize: "12px", maxWidth: "120px" }}
                    title="设计流派"
                  >
                    {expert.styles.map((style) => (
                      <option key={style.id} value={style.id}>
                        {style.name.split("(")[0].trim()}
                      </option>
                    ))}
                  </select>
                );
              })()}
            </>
          )}

          <button
            className={`btn-generate ${(isGenerating || isSubmitting) ? "generating" : ""}`}
            onClick={handleSubmit}
            disabled={
              (!prompt.trim() && !(mode === "edit" && editTask !== "none")) ||
              (mode === "edit" && !editOriginal) ||
              isGenerating ||
              isSubmitting ||
              disabled
            }
          >
            {isGenerating || isSubmitting ? (
              <>
                <span className="spinner" />
                <span>{isGenerating ? "生成中..." : "提交中..."}</span>
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
        experts={experts}
        activeExpertId={activeExpert !== "none" ? activeExpert : experts[0]?.id || "visio"}
        onSave={handleSaveExperts}
      />
    </div>
  );
}

