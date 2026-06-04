import { useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

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
}: GeneratePanelProps) {
  const [prompt, setPrompt] = useState("");
  const [size, setSize] = useState(() => localStorage.getItem("kkimage_size") || "1024x1024");
  const [quality, setQuality] = useState(() => localStorage.getItem("kkimage_quality") || "auto");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

    localStorage.setItem("kkimage_size", size);
    localStorage.setItem("kkimage_quality", quality);

    onGenerate(
      trimmed,
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
      <div className="prompt-area">
        {referenceImages.length > 0 && (
          <div className="reference-strip">
            {referenceImages.map((image) => (
              <div className="reference-thumb" key={image.id} title={image.name}>
                <img src={image.dataUrl} alt="" />
                <button
                  className="reference-remove"
                  type="button"
                  title="移除参考图"
                  onClick={() => onRemoveReferenceImage(image.id)}
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
          placeholder={disabled ? "先在左侧选择一个会话..." : "描述你想生成或修改的图片，支持直接粘贴图片..."}
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

        <div className="params-right">
          <button
            className={`btn-generate ${isGenerating ? "generating" : ""}`}
            onClick={handleSubmit}
            disabled={!prompt.trim() || isGenerating || disabled}
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
    </div>
  );
}
