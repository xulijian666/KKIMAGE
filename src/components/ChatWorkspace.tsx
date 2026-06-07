import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GenerationRecord, SessionRecord } from "./Sidebar";

interface ReferenceImage {
  id: string;
  name: string;
  dataUrl: string;
}

interface ChatWorkspaceProps {
  session: SessionRecord | null;
  records: GenerationRecord[];
  defaultZoom: number;
  onDelete: (id: string) => void;
  onAddReferenceImage: (image: ReferenceImage) => void;
  onPreviewImage: (url: string, name: string) => void;
  onReloadMermaid?: (mermaidCode: string) => void;
}

const imageCache = new Map<string, string>();

const IconImage = () => (
  <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <path d="M7 10l5 5 5-5" />
    <path d="M12 15V3" />
  </svg>
);

const IconX = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18" />
    <path d="M6 6l12 12" />
  </svg>
);

const IconCopy = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const IconRefresh = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
  </svg>
);

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconCode = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function useImageDataUrl(imagePath: string | null) {
  const [dataUrl, setDataUrl] = useState(() => (imagePath ? imageCache.get(imagePath) || "" : ""));

  useEffect(() => {
    if (!imagePath) {
      setDataUrl("");
      return;
    }

    const cached = imageCache.get(imagePath);
    if (cached) {
      setDataUrl(cached);
      return;
    }

    let cancelled = false;
    invoke<string>("get_image_data_url", { imagePath })
      .then((url) => {
        if (cancelled) return;
        imageCache.set(imagePath, url);
        setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  return dataUrl;
}

function copyDataUrlToClipboard(dataUrl: string) {
  return fetch(dataUrl)
    .then((res) => res.blob())
    .then((blob) => navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]));
}

// ========================
// Mermaid code extraction
// ========================

/** Try to extract Mermaid code from a full prompt string */
function extractMermaidCode(prompt: string): string | null {
  const marker = "要绘制的 Mermaid 结构与图形关系描述为：";
  const idx = prompt.indexOf(marker);
  if (idx === -1) return null;
  const code = prompt.slice(idx + marker.length).trim();
  return code || null;
}

/** Check if a prompt looks like it contains Mermaid content */
function isMermaidPrompt(prompt: string): boolean {
  return prompt.includes("要绘制的 Mermaid 结构与图形关系描述为：");
}

/** Extract the style/expert portion of a Mermaid prompt (before the Mermaid marker) */
function extractStylePortion(prompt: string): string {
  const marker = "要绘制的 Mermaid 结构与图形关系描述为：";
  const idx = prompt.indexOf(marker);
  if (idx === -1) return "";
  return prompt.slice(0, idx).trim();
}

// ========================
// Smart Prompt Bubble
// ========================

function SmartPromptBubble({
  prompt,
  onCopyMermaid,
  onReloadMermaid,
}: {
  prompt: string;
  onCopyMermaid: (code: string) => void;
  onReloadMermaid: (code: string) => void;
}) {
  const [codeExpanded, setCodeExpanded] = useState(false);
  const [styleExpanded, setStyleExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isMermaidPrompt(prompt)) {
    // Regular prompt — show as simple text
    return <div className="prompt-bubble">{prompt}</div>;
  }

  const mermaidCode = extractMermaidCode(prompt) || "";
  const stylePortion = extractStylePortion(prompt);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(mermaidCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopyMermaid(mermaidCode);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = mermaidCode;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="prompt-bubble mermaid-prompt-bubble">
      {/* Style info badge */}
      {stylePortion && (
        <div className="mermaid-style-section">
          <button
            type="button"
            className="mermaid-style-badge"
            onClick={() => setStyleExpanded(!styleExpanded)}
          >
            <IconChevron open={styleExpanded} />
            <IconCode />
            <span>专家风格提示词</span>
            <span className="mermaid-style-chars">{stylePortion.length} 字</span>
          </button>
          {styleExpanded && (
            <pre className="mermaid-style-block">
              <code>{stylePortion}</code>
            </pre>
          )}
        </div>
      )}

      {/* Mermaid code block */}
      <div className="mermaid-code-section">
        <button
          type="button"
          className="mermaid-code-header"
          onClick={() => setCodeExpanded(!codeExpanded)}
        >
          <IconChevron open={codeExpanded} />
          <span>Mermaid 源码</span>
          <span className="mermaid-code-lines">{mermaidCode.split("\n").length} 行</span>
        </button>

        {codeExpanded && (
          <pre className="mermaid-code-block">
            <code>{mermaidCode}</code>
          </pre>
        )}

        {/* Action buttons */}
        <div className="mermaid-actions">
          <button
            type="button"
            className="mermaid-action-btn"
            onClick={handleCopy}
            title="复制 Mermaid 代码"
          >
            <IconCopy />
            <span>{copied ? "已复制" : "复制代码"}</span>
          </button>
          <button
            type="button"
            className="mermaid-action-btn"
            onClick={() => onReloadMermaid(mermaidCode)}
            title="加载到编辑器重新修改"
          >
            <IconRefresh />
            <span>重新编辑</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ========================
// Image Card
// ========================

function ImageCard({
  record,
  onPreview,
  onContextMenu,
}: {
  record: GenerationRecord;
  onPreview: (record: GenerationRecord) => void;
  onContextMenu: (event: React.MouseEvent, record: GenerationRecord) => void;
}) {
  const dataUrl = useImageDataUrl(record.image_path);

  if (record.status === "generating") {
    return (
      <div className="chat-image-card generating">
        <div className="generating-spinner" />
        <span>生成中...</span>
      </div>
    );
  }

  if (record.status === "failed") {
    return (
      <div className="chat-image-card failed">
        <strong>生成失败</strong>
        <span>{record.error_message || "未知错误"}</span>
      </div>
    );
  }

  return (
    <button
      className="chat-image-card"
      onClick={() => onPreview(record)}
      onContextMenu={(event) => onContextMenu(event, record)}
    >
      {dataUrl ? <img src={dataUrl} alt={record.prompt} /> : <IconImage />}
    </button>
  );
}

// ========================
// Main Component
// ========================

export function ChatWorkspace({
  session,
  records,
  defaultZoom,
  onDelete,
  onAddReferenceImage,
  onPreviewImage,
  onReloadMermaid,
}: ChatWorkspaceProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; record: GenerationRecord } | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight });
  }, [records.length, session?.id]);

  const openPreview = async (record: GenerationRecord) => {
    setContextMenu(null);
    if (!record.image_path) return;
    try {
      const dataUrl = imageCache.get(record.image_path) || (await invoke<string>("get_image_data_url", { imagePath: record.image_path }));
      imageCache.set(record.image_path, dataUrl);
      onPreviewImage(dataUrl, "生成图");
    } catch (e) {
      console.error("加载预览图失败:", e);
    }
  };

  const handleImageContextMenu = (event: React.MouseEvent, record: GenerationRecord) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, record });
  };

  const handleSaveAs = async (record: GenerationRecord) => {
    if (record.image_path) await invoke("save_image_as", { imagePath: record.image_path });
    setContextMenu(null);
  };

  const handleCopyImage = async (record: GenerationRecord) => {
    const path = record.image_path;
    if (!path) return;
    const dataUrl = imageCache.get(path) || (await invoke<string>("get_image_data_url", { imagePath: path }));
    imageCache.set(path, dataUrl);
    await copyDataUrlToClipboard(dataUrl);
    setContextMenu(null);
  };

  const handleUseAsReference = async (record: GenerationRecord) => {
    if (!record.image_path) return;
    const dataUrl = imageCache.get(record.image_path) || (await invoke<string>("get_image_data_url", { imagePath: record.image_path }));
    imageCache.set(record.image_path, dataUrl);
    onAddReferenceImage({ id: createId(), name: "当前图", dataUrl });
    setContextMenu(null);
  };

  const handleCopyMermaidFromMenu = async (record: GenerationRecord) => {
    const code = extractMermaidCode(record.prompt);
    if (code) {
      await navigator.clipboard.writeText(code);
    }
    setContextMenu(null);
  };

  const handleReloadMermaidFromMenu = (record: GenerationRecord) => {
    const code = extractMermaidCode(record.prompt);
    if (code && onReloadMermaid) {
      onReloadMermaid(code);
    }
    setContextMenu(null);
  };

  return (
    <div className="chat-workspace" onClick={() => setContextMenu(null)}>
      <div className="chat-header">
        <div>
          <h2>{session?.title || "未选择会话"}</h2>
          <span>{records.length} 张生成图</span>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollerRef}>
        {!session ? (
          <div className="empty-state">
            <IconImage />
            <h3>选择或新建一个项目</h3>
            <p>左侧项目下的会话会承载连续生图上下文</p>
          </div>
        ) : records.length === 0 ? (
          <div className="empty-state">
            <IconImage />
            <h3>开始这个会话</h3>
            <p>输入提示词，或粘贴/引用图片作为上下文</p>
          </div>
        ) : (
          records.map((record) => (
            <div className="chat-turn" key={record.id}>
              <SmartPromptBubble
                prompt={record.prompt}
                onCopyMermaid={() => {}}
                onReloadMermaid={(code) => onReloadMermaid?.(code)}
              />
              <ImageCard record={record} onPreview={openPreview} onContextMenu={handleImageContextMenu} />
            </div>
          ))
        )}
      </div>

      {contextMenu && (
        <div
          className="context-menu image-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(event) => event.stopPropagation()}
        >
          <button className="context-menu-item" onClick={() => handleCopyImage(contextMenu.record)}>
            复制图片
          </button>
          <button className="context-menu-item" onClick={() => handleSaveAs(contextMenu.record)}>
            另存为
          </button>
          <button className="context-menu-item" onClick={() => handleUseAsReference(contextMenu.record)}>
            引用当前图
          </button>
          {isMermaidPrompt(contextMenu.record.prompt) && (
            <>
              <div className="context-menu-divider" />
              <button className="context-menu-item" onClick={() => handleCopyMermaidFromMenu(contextMenu.record)}>
                复制 Mermaid 代码
              </button>
              {onReloadMermaid && (
                <button className="context-menu-item" onClick={() => handleReloadMermaidFromMenu(contextMenu.record)}>
                  重新编辑 Mermaid
                </button>
              )}
            </>
          )}
          <div className="context-menu-divider" />
          <button className="context-menu-item danger" onClick={() => onDelete(contextMenu.record.id)}>
            删除
          </button>
        </div>
      )}
    </div>
  );
}
