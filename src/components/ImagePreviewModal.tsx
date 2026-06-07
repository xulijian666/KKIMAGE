import { useEffect, useRef, useState } from "react";

export type DrawingTool = "select" | "pen" | "rect" | "circle";

export interface Shape {
  type: "pen" | "rect" | "circle";
  points?: { x: number; y: number }[];
  x?: number;
  y?: number;
  w?: number;
  h?: number;
}

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  imageName: string;
  onConfirm: (dataUrl: string) => void;
  confirmLabel?: string;
}

const IconPointer = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="M13 13l6 6" />
  </svg>
);

const IconPen = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const IconRect = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const IconCircle = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const IconUndo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export function ImagePreviewModal({ isOpen, onClose, imageUrl, imageName, onConfirm, confirmLabel }: ImagePreviewModalProps) {
  const [zoom, setZoom] = useState(1.0);
  const [activeTool, setActiveTool] = useState<DrawingTool>("select");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // Sync state and drawing when a new image loads or is closed
  useEffect(() => {
    setShapes([]);
    setZoom(1.0);
    setActiveTool("select");
    setCurrentShape(null);
    setDragStart(null);
    setIsPanning(false);
  }, [imageUrl]);

  // Redraw whenever shapes or current active shape change
  useEffect(() => {
    drawShapes();
  }, [shapes, currentShape, imageUrl]);

  // Handle ESC closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCloseOrConfirm();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, shapes, imageUrl]);

  // Setup global mouseUp during dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (currentShape) {
        let isValid = false;
        if (currentShape.type === "pen" && currentShape.points && currentShape.points.length > 1) {
          isValid = true;
        } else if (
          (currentShape.type === "rect" || currentShape.type === "circle") &&
          currentShape.w !== undefined &&
          currentShape.h !== undefined &&
          currentShape.w > 4 &&
          currentShape.h > 4
        ) {
          isValid = true;
        }

        if (isValid) {
          setShapes((prev) => [...prev, currentShape]);
        }
        setCurrentShape(null);
      }
      setDragStart(null);
    };

    if (dragStart) {
      window.addEventListener("mouseup", handleGlobalMouseUp);
    }
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [dragStart, currentShape]);

  if (!isOpen) return null;

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    if (canvasRef.current) {
      canvasRef.current.width = img.naturalWidth;
      canvasRef.current.height = img.naturalHeight;
      drawShapes();
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom((current) => Math.min(12, Math.max(0.1, current * Math.exp(-e.deltaY * 0.0015))));
  };

  const getCanvasCoords = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const rawX = (e.clientX - rect.left) * scaleX;
    const rawY = (e.clientY - rect.top) * scaleY;

    // Clamp coordinates to image dimensions to prevent out-of-bounds painting
    return {
      x: Math.max(0, Math.min(canvas.width, rawX)),
      y: Math.max(0, Math.min(canvas.height, rawY)),
    };
  };

  // Stage Mouse events for Panning
  const handleStageMouseDown = (e: React.MouseEvent) => {
    if (activeTool !== "select") return;
    if (e.button !== 0) return;
    setIsPanning(true);
    setPanStart({
      x: e.clientX,
      y: e.clientY,
      scrollLeft: stageRef.current ? stageRef.current.scrollLeft : 0,
      scrollTop: stageRef.current ? stageRef.current.scrollTop : 0,
    });
  };

  const handleStageMouseMove = (e: React.MouseEvent) => {
    if (!isPanning || !panStart || !stageRef.current) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    stageRef.current.scrollLeft = panStart.scrollLeft - dx;
    stageRef.current.scrollTop = panStart.scrollTop - dy;
  };

  const handleStageMouseUp = () => {
    setIsPanning(false);
  };

  // Drawing mouse events on Canvas
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (activeTool === "select") return;
    if (e.button !== 0) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    setDragStart(coords);

    if (activeTool === "pen") {
      setCurrentShape({
        type: "pen",
        points: [coords],
      });
    } else if (activeTool === "rect" || activeTool === "circle") {
      setCurrentShape({
        type: activeTool,
        x: coords.x,
        y: coords.y,
        w: 0,
        h: 0,
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!dragStart || !currentShape) return;

    const coords = getCanvasCoords(e);
    if (!coords) return;

    if (activeTool === "pen" && currentShape.points) {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, coords],
      });
    } else if (activeTool === "rect" || activeTool === "circle") {
      setCurrentShape({
        ...currentShape,
        x: Math.min(dragStart.x, coords.x),
        y: Math.min(dragStart.y, coords.y),
        w: Math.abs(coords.x - dragStart.x),
        h: Math.abs(coords.y - dragStart.y),
      });
    }
  };

  const drawShapes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const lineWidth = Math.max(3, Math.round(canvas.width / 400));
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "rgba(239, 68, 68, 0.15)";

    const drawSingle = (shape: Shape) => {
      if (shape.type === "pen" && shape.points && shape.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      } else if (
        shape.type === "rect" &&
        shape.x !== undefined &&
        shape.y !== undefined &&
        shape.w !== undefined &&
        shape.h !== undefined
      ) {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (
        shape.type === "circle" &&
        shape.x !== undefined &&
        shape.y !== undefined &&
        shape.w !== undefined &&
        shape.h !== undefined
      ) {
        ctx.beginPath();
        const rx = shape.w / 2;
        const ry = shape.h / 2;
        const cx = shape.x + rx;
        const cy = shape.y + ry;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    };

    shapes.forEach(drawSingle);
    if (currentShape) {
      drawSingle(currentShape);
    }
  };

  const handleExport = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return null;

    const combine = document.createElement("canvas");
    combine.width = canvas.width;
    combine.height = canvas.height;
    const ctx = combine.getContext("2d");
    if (!ctx) return null;

    // 1. Draw bottom image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // 2. Draw markings overlay
    const lineWidth = Math.max(3, Math.round(canvas.width / 400));
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = "#ef4444";
    ctx.fillStyle = "rgba(239, 68, 68, 0.15)";

    const drawSingle = (shape: Shape) => {
      if (shape.type === "pen" && shape.points && shape.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        for (let i = 1; i < shape.points.length; i++) {
          ctx.lineTo(shape.points[i].x, shape.points[i].y);
        }
        ctx.stroke();
      } else if (
        shape.type === "rect" &&
        shape.x !== undefined &&
        shape.y !== undefined &&
        shape.w !== undefined &&
        shape.h !== undefined
      ) {
        ctx.fillRect(shape.x, shape.y, shape.w, shape.h);
        ctx.strokeRect(shape.x, shape.y, shape.w, shape.h);
      } else if (
        shape.type === "circle" &&
        shape.x !== undefined &&
        shape.y !== undefined &&
        shape.w !== undefined &&
        shape.h !== undefined
      ) {
        ctx.beginPath();
        const rx = shape.w / 2;
        const ry = shape.h / 2;
        const cx = shape.x + rx;
        const cy = shape.y + ry;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      }
    };

    shapes.forEach(drawSingle);
    return combine.toDataURL("image/png");
  };

  const handleCloseOrConfirm = () => {
    if (shapes.length > 0) {
      const merged = handleExport();
      if (merged) {
        onConfirm(merged);
      }
    }
    onClose();
  };

  const handleReferenceClick = () => {
    const merged = handleExport();
    if (merged) {
      onConfirm(merged);
    }
    onClose();
  };

  return (
    <div className="preview-overlay" onClick={handleCloseOrConfirm}>
      <div className="preview-shell" onClick={(e) => e.stopPropagation()} style={{ display: "flex", flexDirection: "column" }}>
        {/* Top Header Toolbar */}
        <div className="preview-toolbar">
          <span>{imageName || "图片预览"} - {Math.round(zoom * 100)}%</span>
          <div className="preview-toolbar-actions">
            <button className="btn-icon" onClick={handleCloseOrConfirm}>
              <IconX />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="preview-body" style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Main Stage (Left) */}
          <div
            ref={stageRef}
            className="preview-stage"
            onWheel={handleWheel}
            onMouseDown={handleStageMouseDown}
            onMouseMove={handleStageMouseMove}
            onMouseUp={handleStageMouseUp}
            style={{
              flex: 1,
              overflow: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#121214",
              cursor: activeTool === "select" ? (isPanning ? "grabbing" : "grab") : "default",
            }}
          >
            {imageUrl && (
              <div
                className="preview-image-wrap"
                style={{
                  position: "relative",
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                  display: "inline-block",
                }}
              >
                <img
                  ref={imageRef}
                  src={imageUrl}
                  alt={imageName}
                  onLoad={handleImageLoad}
                  draggable={false}
                  style={{
                    display: "block",
                    maxWidth: "80vw",
                    maxHeight: "75vh",
                    objectFit: "contain",
                    userSelect: "none",
                    pointerEvents: "none",
                  }}
                />
                <canvas
                  ref={canvasRef}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    cursor: activeTool !== "select" ? "crosshair" : "inherit",
                    pointerEvents: activeTool !== "select" ? "auto" : "none",
                  }}
                />
              </div>
            )}
          </div>

          {/* Controls Panel (Right Sidebar) */}
          <div
            className="preview-control-panel"
            style={{
              width: "160px",
              background: "var(--bg-sidebar)",
              borderLeft: "1px solid var(--border-color)",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                画笔模式
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                <button
                  type="button"
                  title="选择与拖拽"
                  onClick={() => setActiveTool("select")}
                  style={{
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: activeTool === "select" ? "var(--color-primary)" : "var(--border-color)",
                    background: activeTool === "select" ? "var(--bg-active-item)" : "var(--bg-main)",
                    color: activeTool === "select" ? "var(--text-active-item)" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <IconPointer />
                </button>
                <button
                  type="button"
                  title="手绘画笔"
                  onClick={() => setActiveTool("pen")}
                  style={{
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: activeTool === "pen" ? "var(--color-primary)" : "var(--border-color)",
                    background: activeTool === "pen" ? "var(--bg-active-item)" : "var(--bg-main)",
                    color: activeTool === "pen" ? "var(--text-active-item)" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <IconPen />
                </button>
                <button
                  type="button"
                  title="画矩形"
                  onClick={() => setActiveTool("rect")}
                  style={{
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: activeTool === "rect" ? "var(--color-primary)" : "var(--border-color)",
                    background: activeTool === "rect" ? "var(--bg-active-item)" : "var(--bg-main)",
                    color: activeTool === "rect" ? "var(--text-active-item)" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <IconRect />
                </button>
                <button
                  type="button"
                  title="画圆形"
                  onClick={() => setActiveTool("circle")}
                  style={{
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: activeTool === "circle" ? "var(--color-primary)" : "var(--border-color)",
                    background: activeTool === "circle" ? "var(--bg-active-item)" : "var(--bg-main)",
                    color: activeTool === "circle" ? "var(--text-active-item)" : "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  <IconCircle />
                </button>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", letterSpacing: "0.5px", textTransform: "uppercase" }}>
                绘制操作
              </div>
              <button
                type="button"
                disabled={shapes.length === 0}
                onClick={() => setShapes((prev) => prev.slice(0, -1))}
                style={{
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-main)",
                  color: "var(--text-primary)",
                  cursor: "pointer",
                  fontSize: "12px",
                  opacity: shapes.length === 0 ? 0.4 : 1,
                }}
              >
                <IconUndo />
                <span>撤销</span>
              </button>
              <button
                type="button"
                disabled={shapes.length === 0}
                onClick={() => setShapes([])}
                style={{
                  height: "30px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  borderRadius: "6px",
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-main)",
                  color: "var(--color-red)",
                  cursor: "pointer",
                  fontSize: "12px",
                  opacity: shapes.length === 0 ? 0.4 : 1,
                }}
              >
                <IconTrash />
                <span>清空</span>
              </button>
            </div>

            <div style={{ flex: 1 }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                className="btn-primary"
                type="button"
                onClick={handleReferenceClick}
                style={{
                  width: "100%",
                  height: "34px",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                {confirmLabel || "引用当前图"}
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={handleCloseOrConfirm}
                style={{
                  width: "100%",
                  height: "34px",
                  fontSize: "12.5px",
                  fontWeight: 500,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                }}
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
