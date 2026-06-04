import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { GenerationRecord } from "./Sidebar";

interface ImageViewerProps {
  record: GenerationRecord | null;
  onDelete: (id: string) => void;
}

/// SVG 图标
const IconZoomIn = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const IconZoomOut = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const IconDownload = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconFolder = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </svg>
);

const IconCopy = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const IconTrash = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
    <path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const IconImage = () => (
  <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="9" cy="10" r="2" />
    <path d="M21 15l-5-5L5 21" />
  </svg>
);

export function ImageViewer({ record, onDelete }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 加载图片
  useEffect(() => {
    if (!record?.image_path) {
      setImageUrl(null);
      return;
    }

    setLoading(true);
    invoke<string>("get_image_data_url", { imagePath: record.image_path })
      .then((dataUrl) => {
        setImageUrl(dataUrl);
        setLoading(false);
      })
      .catch(() => {
        setImageUrl(null);
        setLoading(false);
      });

    setZoom(1);
  }, [record?.id, record?.image_path]);

  const handleZoomIn = useCallback(() => {
    setZoom((z) => Math.min(z + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((z) => Math.max(z - 0.25, 0.25));
  }, []);

  const handleOpenFolder = useCallback(() => {
    if (record?.image_path) {
      invoke("open_image_folder", { imagePath: record.image_path });
    }
  }, [record?.image_path]);

  const handleCopyPrompt = useCallback(() => {
    if (record?.prompt) {
      navigator.clipboard.writeText(record.prompt);
    }
  }, [record?.prompt]);

  // 空状态
  if (!record) {
    return (
      <div className="image-viewer empty">
        <div className="empty-state">
          <IconImage />
          <h3>KKIMAGE</h3>
          <p>输入提示词，开始 AI 图片创作</p>
        </div>
      </div>
    );
  }

  // 生成中状态
  if (record.status === "generating") {
    return (
      <div className="image-viewer loading">
        <div className="generating-state">
          <div className="generating-spinner" />
          <h3>正在生成中...</h3>
          <p className="generating-prompt">{record.prompt}</p>
        </div>
      </div>
    );
  }

  // 失败状态
  if (record.status === "failed") {
    return (
      <div className="image-viewer error">
        <div className="error-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <h3>生成失败</h3>
          <p className="error-message">{record.error_message || "未知错误"}</p>
          <p className="error-prompt">提示词: {record.prompt}</p>
        </div>
      </div>
    );
  }

  // 图片展示
  return (
    <div className="image-viewer">
      {/* 工具栏 */}
      <div className="viewer-toolbar">
        <div className="toolbar-left">
          <button className="btn-icon" title="缩小" onClick={handleZoomOut}>
            <IconZoomOut />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="btn-icon" title="放大" onClick={handleZoomIn}>
            <IconZoomIn />
          </button>
        </div>
        <div className="toolbar-right">
          <button className="btn-icon" title="复制提示词" onClick={handleCopyPrompt}>
            <IconCopy />
          </button>
          <button className="btn-icon" title="打开文件夹" onClick={handleOpenFolder}>
            <IconFolder />
          </button>
          <button
            className="btn-icon"
            title="删除"
            onClick={() => {
              if (confirm("确定删除这条记录吗？")) onDelete(record.id);
            }}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* 图片区域 */}
      <div className="viewer-image-area">
        {loading ? (
          <div className="generating-spinner" />
        ) : imageUrl ? (
          <div
            className="viewer-image-scroll"
            style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
          >
            <img src={imageUrl} alt={record.prompt} draggable={false} />
          </div>
        ) : (
          <div className="empty-state">
            <IconImage />
            <p>图片加载失败</p>
          </div>
        )}
      </div>

      {/* 信息栏 */}
      <div className="viewer-info">
        <div className="info-prompt">{record.prompt}</div>
        <div className="info-meta">
          <span>{record.model}</span>
          <span>{record.size}</span>
          <span>{record.quality}</span>
        </div>
      </div>
    </div>
  );
}
