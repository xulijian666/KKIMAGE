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

export function ChatWorkspace({
  session,
  records,
  defaultZoom,
  onDelete,
  onAddReferenceImage,
  onPreviewImage,
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
      onPreviewImage(dataUrl, record.prompt || "生成图");
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
              <div className="prompt-bubble">{record.prompt}</div>
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
          <button className="context-menu-item danger" onClick={() => onDelete(contextMenu.record.id)}>
            删除
          </button>
        </div>
      )}
    </div>
  );
}
