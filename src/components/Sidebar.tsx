import { useEffect, useMemo, useState } from "react";

export interface ProjectRecord {
  id: string;
  name: string;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface GenerationRecord {
  id: string;
  project_id: string;
  session_id: string;
  prompt: string;
  model: string;
  size: string;
  quality: string;
  status: string;
  image_path: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface SidebarProps {
  projects: ProjectRecord[];
  sessions: SessionRecord[];
  records: GenerationRecord[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onCreateProject: () => void;
  onCreateSession: (projectId: string) => void;
  onRenameProject: (id: string, name: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onRenameSession: (id: string, title: string) => Promise<void>;
  onDeleteSession: (id: string) => Promise<void>;
  collapsed: boolean;
  onToggleCollapse: () => void;
  width: number;
}

const IconFolder = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
  </svg>
);

const IconChevronDown = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const IconPanel = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </svg>
);

const IconSearch = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <path d="M21 21l-4.3-4.3" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const IconCopy = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </svg>
);

const IconEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

function formatRelative(iso: string): string {
  const time = new Date(`${iso.replace(" ", "T")}Z`).getTime();
  if (Number.isNaN(time)) return "";
  const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.round(hours / 24)}天前`;
}

export function Sidebar({
  projects,
  sessions,
  records,
  activeSessionId,
  onSelectSession,
  onCreateProject,
  onCreateSession,
  onRenameProject,
  onDeleteProject,
  onRenameSession,
  onDeleteSession,
  collapsed,
  onToggleCollapse,
  width,
}: SidebarProps) {
  const [query, setQuery] = useState("");
  const [openProjects, setOpenProjects] = useState(() => new Set(projects.map((p) => p.id)));
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "project" | "session";
    id: string;
    name: string;
  } | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const recordsBySession = useMemo(() => {
    const map = new Map<string, GenerationRecord[]>();
    for (const record of records) {
      const list = map.get(record.session_id) || [];
      list.push(record);
      map.set(record.session_id, list);
    }
    return map;
  }, [records]);

  useEffect(() => {
    setOpenProjects((prev) => {
      const next = new Set(prev);
      for (const project of projects) next.add(project.id);
      return next;
    });
  }, [projects]);

  const visibleSessions = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return sessions;
    return sessions.filter((session) => {
      const prompts = recordsBySession.get(session.id)?.map((r) => r.prompt).join(" ") || "";
      return `${session.title} ${prompts}`.toLowerCase().includes(term);
    });
  }, [query, recordsBySession, sessions]);

  const toggleProject = (projectId: string) => {
    setOpenProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  };

  const copySessionPrompt = async (sessionId: string) => {
    const latest = [...(recordsBySession.get(sessionId) || [])].reverse().find((r) => r.prompt);
    if (latest) await navigator.clipboard.writeText(latest.prompt);
    setContextMenu(null);
  };

  const handleSaveRename = async (id: string, type: "project" | "session") => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== "") {
      try {
        if (type === "project") {
          await onRenameProject(id, trimmed);
        } else {
          await onRenameSession(id, trimmed);
        }
      } catch (err) {
        console.error("重命名失败", err);
      }
    }
    setEditingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string, type: "project" | "session") => {
    if (e.key === "Enter") {
      handleSaveRename(id, type);
    } else if (e.key === "Escape") {
      setEditingId(null);
    }
  };

  if (collapsed) {
    return (
      <div className="sidebar collapsed" onClick={onToggleCollapse}>
        <div className="sidebar-collapse-btn">
          <IconPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar project-sidebar" style={{ width, minWidth: width, maxWidth: width }}>
      <div className="sidebar-top-actions">
        <button className="new-project-btn" onClick={onCreateProject}>
          <IconPlus />
          <span>新建项目</span>
        </button>
        <button className="btn-icon" title="收起侧栏" onClick={onToggleCollapse}>
          <IconPanel />
        </button>
      </div>

      <label className="sidebar-search">
        <IconSearch />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索本地会话项目..."
        />
      </label>

      <div className="tree-title">会话管理</div>

      <div className="project-tree" onClick={() => setContextMenu(null)}>
        {projects.map((project) => {
          const projectSessions = visibleSessions.filter((session) => session.project_id === project.id);
          const isOpen = openProjects.has(project.id);
          const count = sessions.filter((session) => session.project_id === project.id).length;

          return (
            <div className="project-block" key={project.id}>
              <div
                className="project-row"
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    type: "project",
                    id: project.id,
                    name: project.name,
                  });
                }}
              >
                <button className="tree-toggle" onClick={() => toggleProject(project.id)}>
                  {isOpen ? <IconChevronDown /> : <IconChevronRight />}
                </button>
                {editingId === project.id ? (
                  <input
                    className="rename-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => handleRenameKeyDown(e, project.id, "project")}
                    onBlur={() => handleSaveRename(project.id, "project")}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <button className="project-name" onClick={() => toggleProject(project.id)}>
                    <IconFolder />
                    <span>{project.name}</span>
                  </button>
                )}
                <span className="project-count">{count}</span>
                <button
                  className="project-add-session"
                  title="新建会话"
                  onClick={() => onCreateSession(project.id)}
                >
                  <IconPlus />
                </button>
              </div>

              {isOpen && (
                <div className="session-list">
                  {projectSessions.map((session) => {
                    const sessionRecords = recordsBySession.get(session.id) || [];
                    const latest = sessionRecords[sessionRecords.length - 1];
                    return (
                      <div
                        key={session.id}
                        className={`session-row ${activeSessionId === session.id ? "active" : ""}`}
                        onClick={() => onSelectSession(session.id)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            type: "session",
                            id: session.id,
                            name: session.title,
                          });
                        }}
                      >
                        <span className="session-dot" />
                        {editingId === session.id ? (
                          <input
                            className="rename-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => handleRenameKeyDown(e, session.id, "session")}
                            onBlur={() => handleSaveRename(session.id, "session")}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="session-title">{session.title}</span>
                        )}
                        <span className="session-time">{formatRelative(latest?.created_at || session.updated_at)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <div
          className="context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === "session" ? (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  setEditingId(contextMenu.id);
                  setEditValue(contextMenu.name);
                  setContextMenu(null);
                }}
              >
                <IconEdit />
                <span>重命名</span>
              </button>
              <button className="context-menu-item" onClick={() => copySessionPrompt(contextMenu.id)}>
                <IconCopy />
                <span>复制提示词</span>
              </button>
              <button
                className="context-menu-item danger"
                onClick={() => {
                  setContextMenu(null);
                  if (confirm(`确定删除会话「${contextMenu.name}」吗？所有生成记录将被永久删除。`)) {
                    onDeleteSession(contextMenu.id);
                  }
                }}
              >
                <IconTrash />
                <span>删除</span>
              </button>
            </>
          ) : (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  setEditingId(contextMenu.id);
                  setEditValue(contextMenu.name);
                  setContextMenu(null);
                }}
              >
                <IconEdit />
                <span>重命名项目</span>
              </button>
              <button
                className="context-menu-item"
                onClick={() => {
                  onCreateSession(contextMenu.id);
                  setContextMenu(null);
                }}
              >
                <IconPlus />
                <span>新建会话</span>
              </button>
              <button
                className="context-menu-item danger"
                onClick={() => {
                  setContextMenu(null);
                  if (confirm(`确定删除项目「${contextMenu.name}」吗？这会删除该项目下的所有会话和生成记录，且无法恢复。`)) {
                    onDeleteProject(contextMenu.id);
                  }
                }}
              >
                <IconTrash />
                <span>删除项目</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
