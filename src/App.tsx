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

  const activeSession = workspace.sessions.find((session) => session.id === activeSessionId) || null;
  const activeRecords = workspace.generations.filter((record) => record.session_id === activeSessionId);
  const latestCompletedRecord = [...activeRecords].reverse().find((record) => record.status === "completed");

  useEffect(() => {
    applyTheme(currentTheme);
  }, [currentTheme]);

  const loadWorkspace = useCallback(async () => {
    const data = await invoke<WorkspaceSnapshot>("get_workspace");
    setWorkspace(data);
    setActiveSessionId((current) => current || data.sessions[0]?.id || null);
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
    setReferenceImages((prev) => [...prev, ...images].slice(0, 6));
  }, []);

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
    </div>
  );
}

export default App;
