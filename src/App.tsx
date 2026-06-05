import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ChatWorkspace } from "./components/ChatWorkspace";
import { GeneratePanel, ReferenceImage } from "./components/GeneratePanel";
import {
  GenerationRecord,
  ProjectRecord,
  SessionRecord,
  Sidebar,
} from "./components/Sidebar";
import { SettingsModal } from "./components/SettingsModal";
import { ImagePreviewModal } from "./components/ImagePreviewModal";
import { applyTheme, DEFAULT_THEME } from "./utils/themes";
import { log } from "./utils/helpers";
import "./App.css";

interface WorkspaceSnapshot {
  projects: ProjectRecord[];
  sessions: SessionRecord[];
  generations: GenerationRecord[];
}

function App() {
  const appWindow = useRef(getCurrentWindow()).current;

  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem("kkimage_theme") || DEFAULT_THEME;
  });
  const [workspace, setWorkspace] = useState<WorkspaceSnapshot>({
    projects: [],
    sessions: [],
    generations: [],
  });
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [defaultZoom, setDefaultZoom] = useState(() => {
    return Number(localStorage.getItem("kkimage_default_zoom")) || 1;
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("kkimage_sidebar_width");
    return saved ? Number(saved) : 300;
  });

  const [previewData, setPreviewData] = useState<{ url: string; name: string } | null>(null);

  const [mode, setMode] = useState<"generate" | "edit">(() => {
    return (localStorage.getItem("kkimage_mode") as "generate" | "edit") || "generate";
  });

  const handleModeChange = useCallback((newMode: "generate" | "edit") => {
    setMode(newMode);
    localStorage.setItem("kkimage_mode", newMode);
  }, []);

  const handleConfirmPreviewImage = useCallback((dataUrl: string) => {
    const newImage: ReferenceImage = {
      id: `annotated-${Date.now()}`,
      name: "标注图",
      dataUrl,
    };
    if (mode === "edit") {
      setReferenceImages((prev) => {
        if (prev.length > 0) {
          // Keep the clean original image (prev[0]), and set/replace the annotated image as the second image
          return [prev[0], newImage];
        }
        return [newImage];
      });
    } else {
      setReferenceImages((prev) => {
        const filtered = prev.filter((img) => img.dataUrl !== dataUrl);
        return [newImage, ...filtered].slice(0, 6);
      });
    }
  }, [mode]);

  const activeSession = workspace.sessions.find((session) => session.id === activeSessionId) || null;
  const activeRecords = workspace.generations.filter((record) => record.session_id === activeSessionId);
  const latestCompletedRecord = [...activeRecords].reverse().find((record) => record.status === "completed");

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const loadWorkspace = useCallback(async () => {
    const data = await invoke<WorkspaceSnapshot>("get_workspace");
    setWorkspace(data);
    setActiveSessionId((current) => {
      const exists = data.sessions.some((s) => s.id === current);
      return exists ? current : (data.sessions[0]?.id || null);
    });
  }, []);

  useEffect(() => {
    loadWorkspace().catch((err) => log(`加载工作区失败: ${err}`));
  }, [loadWorkspace]);

  useEffect(() => {
    invoke<string | null>("get_setting", { key: "default_zoom" })
      .then((value) => {
        if (value) {
          const zoom = Number(value) || 1;
          setDefaultZoom(zoom);
          localStorage.setItem("kkimage_default_zoom", String(zoom));
        }
      })
      .catch(() => {});
  }, []);

  // 初始化时从环境变量读取默认配置并保存到数据库
  useEffect(() => {
    const envApiKey = import.meta.env.VITE_API_KEY;
    const envBaseUrl = import.meta.env.VITE_API_BASE_URL;
    const envModel = import.meta.env.VITE_MODEL;

    if (envApiKey) {
      invoke<string | null>("get_setting", { key: "api_key" })
        .then((value) => {
          if (!value) {
            invoke("save_setting", { key: "api_key", value: envApiKey }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    if (envBaseUrl) {
      invoke<string | null>("get_setting", { key: "base_url" })
        .then((value) => {
          if (!value) {
            invoke("save_setting", { key: "base_url", value: envBaseUrl }).catch(() => {});
          }
        })
        .catch(() => {});
    }

    if (envModel) {
      invoke<string | null>("get_setting", { key: "model" })
        .then((value) => {
          if (!value) {
            invoke("save_setting", { key: "model", value: envModel }).catch(() => {});
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const unlistenStart = listen<GenerationRecord>("generation-started", (event) => {
      const rec = event.payload;
      setWorkspace((prev) => ({
        ...prev,
        generations: [...prev.generations.filter((item) => item.id !== rec.id), rec],
      }));
      setActiveSessionId(rec.session_id);
      setIsGenerating(true);
    });

    const unlistenComplete = listen<GenerationRecord>("generation-completed", (event) => {
      const rec = event.payload;
      setWorkspace((prev) => ({
        ...prev,
        generations: prev.generations.map((item) => (item.id === rec.id ? rec : item)),
      }));
      setIsGenerating(false);
      loadWorkspace().catch(() => {});
    });

    const unlistenFail = listen<GenerationRecord>("generation-failed", (event) => {
      const rec = event.payload;
      setWorkspace((prev) => ({
        ...prev,
        generations: prev.generations.map((item) => (item.id === rec.id ? rec : item)),
      }));
      setIsGenerating(false);
      loadWorkspace().catch(() => {});
    });

    return () => {
      unlistenStart.then((fn) => fn());
      unlistenComplete.then((fn) => fn());
      unlistenFail.then((fn) => fn());
    };
  }, [loadWorkspace]);

  const handleGenerate = useCallback(
    async (prompt: string, model: string, size: string, quality: string, inputImages: string[]) => {
      if (!activeSession) return;
      try {
        await invoke("generate_image", {
          request: {
            prompt,
            model,
            size,
            quality,
            input_images: inputImages,
            project_id: activeSession.project_id,
            session_id: activeSession.id,
          },
        });
      } catch (err) {
        setIsGenerating(false);
        log(`生成失败: ${err}`);
      }
    },
    [activeSession]
  );

  const handleCreateProject = useCallback(async () => {
    const next = await invoke<WorkspaceSnapshot>("create_project", { name: "新项目" });
    setWorkspace(next);
    setActiveSessionId(next.sessions[0]?.id || null);
  }, []);

  const handleCreateSession = useCallback(async (projectId: string) => {
    const next = await invoke<WorkspaceSnapshot>("create_session", {
      projectId,
      title: "新会话",
    });
    setWorkspace(next);
    const session = next.sessions.find((item) => item.project_id === projectId);
    setActiveSessionId(session?.id || next.sessions[0]?.id || null);
  }, []);

  const handleRenameProject = useCallback(async (id: string, name: string) => {
    try {
      const next = await invoke<WorkspaceSnapshot>("rename_project", { id, name });
      setWorkspace(next);
    } catch (err) {
      log(`重命名项目失败: ${err}`);
    }
  }, []);

  const handleDeleteProject = useCallback(async (id: string) => {
    try {
      const next = await invoke<WorkspaceSnapshot>("delete_project", { id });
      setWorkspace(next);
      setActiveSessionId((current) => {
        const activeSessionBelongsToDeleted = workspace.sessions.some(
          (s) => s.id === current && s.project_id === id
        );
        if (activeSessionBelongsToDeleted) {
          return next.sessions[0]?.id || null;
        }
        return current;
      });
    } catch (err) {
      log(`删除项目失败: ${err}`);
    }
  }, [workspace.sessions]);

  const handleRenameSession = useCallback(async (id: string, title: string) => {
    try {
      const next = await invoke<WorkspaceSnapshot>("rename_session", { id, title });
      setWorkspace(next);
    } catch (err) {
      log(`重命名会话失败: ${err}`);
    }
  }, []);

  const handleDeleteSession = useCallback(async (id: string) => {
    try {
      const next = await invoke<WorkspaceSnapshot>("delete_session", { id });
      setWorkspace(next);
      setActiveSessionId((current) => {
        if (current === id) {
          return next.sessions[0]?.id || null;
        }
        return current;
      });
    } catch (err) {
      log(`删除会话失败: ${err}`);
    }
  }, []);

  const handleDeleteRecord = useCallback(
    async (id: string) => {
      try {
        await invoke("delete_generation", { id });
        setWorkspace((prev) => ({
          ...prev,
          generations: prev.generations.filter((record) => record.id !== id),
        }));
      } catch (err) {
        log(`删除失败: ${err}`);
      }
    },
    []
  );

  const handleAddReferenceImages = useCallback((images: ReferenceImage[]) => {
    if (mode === "edit") {
      if (images.length > 0) {
        setReferenceImages([images[0]]);
      }
    } else {
      setReferenceImages((prev) => [...prev, ...images].slice(0, 6));
    }
  }, [mode]);

  const handleRemoveReferenceImage = useCallback((id: string) => {
    setReferenceImages((prev) => prev.filter((image) => image.id !== id));
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    let nextWidth = sidebarWidth;

    const handleMouseMove = (ev: MouseEvent) => {
      nextWidth = Math.max(220, Math.min(480, ev.clientX));
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      localStorage.setItem("kkimage_sidebar_width", String(nextWidth));
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth]);

  // 全局右键菜单状态
  const [globalContextMenu, setGlobalContextMenu] = useState<{
    x: number;
    y: number;
    targetIsInput: boolean;
    hasSelection: boolean;
  } | null>(null);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      // 禁用原生的右键菜单
      e.preventDefault();

      if (e.defaultPrevented) {
        return;
      }

      const target = e.target as HTMLElement;
      const targetIsInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const hasSelection = (window.getSelection()?.toString() || "").trim().length > 0;

      setGlobalContextMenu({
        x: e.clientX,
        y: e.clientY,
        targetIsInput,
        hasSelection,
      });
    };

    const handleClick = () => {
      setGlobalContextMenu(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGlobalContextMenu(null);
      }
    };

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const handleGlobalCopy = () => {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    const hasSelectionInInput =
      activeEl &&
      (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
      activeEl.selectionStart !== activeEl.selectionEnd;

    let textToCopy = "";
    if (hasSelectionInInput) {
      textToCopy = activeEl.value.substring(activeEl.selectionStart || 0, activeEl.selectionEnd || 0);
    } else {
      textToCopy = window.getSelection()?.toString() || "";
    }

    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
    }
    setGlobalContextMenu(null);
  };

  const handleGlobalCut = () => {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      const start = activeEl.selectionStart || 0;
      const end = activeEl.selectionEnd || 0;
      const val = activeEl.value;
      const textToCut = val.substring(start, end);
      if (textToCut) {
        navigator.clipboard.writeText(textToCut);
        activeEl.value = val.slice(0, start) + val.slice(end);
        activeEl.selectionStart = activeEl.selectionEnd = start;
        const event = new Event("input", { bubbles: true });
        activeEl.dispatchEvent(event);
      }
    }
    setGlobalContextMenu(null);
  };

  const handleGlobalPaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
        const start = activeEl.selectionStart || 0;
        const end = activeEl.selectionEnd || 0;
        const val = activeEl.value;
        activeEl.value = val.slice(0, start) + text + val.slice(end);
        activeEl.selectionStart = activeEl.selectionEnd = start + text.length;
        const event = new Event("input", { bubbles: true });
        activeEl.dispatchEvent(event);
      }
    } catch (err) {
      console.error("粘贴失败", err);
    }
    setGlobalContextMenu(null);
  };

  const handleGlobalSelectAll = () => {
    const activeEl = document.activeElement as HTMLInputElement | HTMLTextAreaElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) {
      activeEl.select();
    } else {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(document.body);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    setGlobalContextMenu(null);
  };

  const handleGlobalRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="app-container">
      <div className="titlebar" data-tauri-drag-region>
        <div className="titlebar-left" data-tauri-drag-region>
          <div className="titlebar-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
          </div>
          <span className="titlebar-title" data-tauri-drag-region>KKIMAGE</span>
        </div>

        <div className="titlebar-right">
          <button className="titlebar-btn" onClick={() => setShowSettings(true)} title="设置">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>
          <button className="titlebar-btn" onClick={() => appWindow.minimize().catch(() => {})} title="最小化">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button className="titlebar-btn" onClick={() => appWindow.toggleMaximize().catch(() => {})} title="最大化">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="5" width="14" height="14" rx="2" />
            </svg>
          </button>
          <button className="titlebar-btn close" onClick={() => appWindow.close().catch(() => {})} title="关闭">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      <div className="app-body">
        <Sidebar
          projects={workspace.projects}
          sessions={workspace.sessions}
          records={workspace.generations}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onCreateProject={handleCreateProject}
          onCreateSession={handleCreateSession}
          onRenameProject={handleRenameProject}
          onDeleteProject={handleDeleteProject}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
          width={sidebarWidth}
        />

        {!sidebarCollapsed && <div className="sidebar-resizer" onMouseDown={handleResizeStart} />}

        <div className="main-workspace">
          <ChatWorkspace
            session={activeSession}
            records={activeRecords}
            defaultZoom={defaultZoom}
            onDelete={handleDeleteRecord}
            onAddReferenceImage={(image) => handleAddReferenceImages([image])}
            onPreviewImage={(url, name) => setPreviewData({ url, name })}
          />

          <GeneratePanel
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            disabled={!activeSession}
            activeImagePath={latestCompletedRecord?.image_path || null}
            referenceImages={referenceImages}
            onAddReferenceImages={handleAddReferenceImages}
            onRemoveReferenceImage={handleRemoveReferenceImage}
            onClearReferenceImages={() => setReferenceImages([])}
            onPreviewImage={(url, name) => setPreviewData({ url, name })}
            mode={mode}
            onModeChange={handleModeChange}
          />
        </div>
      </div>

      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        currentTheme={currentTheme}
        onThemeChange={setCurrentTheme}
        defaultZoom={defaultZoom}
        onDefaultZoomChange={setDefaultZoom}
      />

      {globalContextMenu && (
        <div
          className="context-menu"
          style={{ top: globalContextMenu.y, left: globalContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {globalContextMenu.targetIsInput ? (
            <>
              <button
                className="context-menu-item"
                onClick={handleGlobalCut}
                disabled={!globalContextMenu.hasSelection}
              >
                剪切
              </button>
              <button
                className="context-menu-item"
                onClick={handleGlobalCopy}
                disabled={!globalContextMenu.hasSelection}
              >
                复制
              </button>
              <button className="context-menu-item" onClick={handleGlobalPaste}>
                粘贴
              </button>
              <div className="settings-divider" style={{ margin: "4px 0" }} />
              <button className="context-menu-item" onClick={handleGlobalSelectAll}>
                全选
              </button>
            </>
          ) : (
            <>
              <button
                className="context-menu-item"
                onClick={handleGlobalCopy}
                disabled={!globalContextMenu.hasSelection}
              >
                复制
              </button>
              <button className="context-menu-item" onClick={handleGlobalSelectAll}>
                全选
              </button>
              <div className="settings-divider" style={{ margin: "4px 0" }} />
              <button className="context-menu-item" onClick={handleGlobalRefresh}>
                刷新页面
              </button>
            </>
          )}
        </div>
      )}

      {previewData && (
        <ImagePreviewModal
          isOpen={!!previewData}
          imageUrl={previewData.url}
          imageName={previewData.name}
          onClose={() => setPreviewData(null)}
          onConfirm={handleConfirmPreviewImage}
        />
      )}
    </div>
  );
}

export default App;
