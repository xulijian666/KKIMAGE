import { useEffect, useState } from "react";
import { BUILTIN_EXPERTS } from "../utils/defaultExperts";

// ========================
// Types
// ========================

export interface StylePreset {
  id: string;
  name: string;
  prompt: string;
  isDefault?: boolean;
}

export interface ExpertDef {
  id: string;
  name: string;
  description: string;
  isBuiltIn: boolean;
  basePrompt: string;
  styles: StylePreset[];
}

export interface ExpertConfig {
  activeStyleId: string;
  styles: StylePreset[];
}

interface ExpertModalProps {
  isOpen: boolean;
  onClose: () => void;
  experts: ExpertDef[];
  activeExpertId: string;
  onSave: (experts: ExpertDef[], activeStyleId: string) => void;
}

// Built-in experts are imported from ../utils/defaultExperts

export function loadExperts(): ExpertDef[] {
  try {
    // Check version for migration
    const version = localStorage.getItem("kkimage_expert_version");
    if (version !== "v2") {
      const stored = localStorage.getItem("kkimage_experts");
      let custom: ExpertDef[] = [];
      if (stored) {
        try {
          custom = JSON.parse(stored) as ExpertDef[];
        } catch (e) {
          custom = [];
        }
      }

      const migratedCustom: ExpertDef[] = [];

      // Collect custom styles from old 'visio' and 'arch' experts
      const oldVisio = custom.find(e => e.id === "visio");
      const oldArch = custom.find(e => e.id === "arch");

      if (oldVisio) {
        const customStyles = oldVisio.styles.filter(s => !s.isDefault);
        if (customStyles.length > 0) {
          migratedCustom.push({
            id: "flowchart",
            name: "流程图/泳道图专家",
            description: "",
            isBuiltIn: true,
            basePrompt: "",
            styles: customStyles
          });
        }
      }

      if (oldArch) {
        const customStyles = oldArch.styles.filter(s => !s.isDefault);
        if (customStyles.length > 0) {
          migratedCustom.push({
            id: "arch",
            name: "系统架构图专家",
            description: "",
            isBuiltIn: true,
            basePrompt: "",
            styles: customStyles
          });
        }
      }

      // Keep other custom experts
      for (const e of custom) {
        if (e.id !== "visio" && e.id !== "arch" && !e.isBuiltIn) {
          migratedCustom.push(e);
        }
      }

      // Save migrated custom experts
      localStorage.setItem("kkimage_experts", JSON.stringify(migratedCustom));
      localStorage.setItem("kkimage_expert_version", "v2");

      // Reset active selections to prevent loading invalid IDs
      localStorage.setItem("kkimage_active_expert", "flowchart");
      localStorage.setItem("kkimage_active_style_id", "classic-blue");

      return mergeExperts(BUILTIN_EXPERTS, migratedCustom);
    }

    const stored = localStorage.getItem("kkimage_experts");
    if (stored) {
      const custom = JSON.parse(stored) as ExpertDef[];
      const migratedCustom = custom.map(e => ({
        ...e,
        basePrompt: e.basePrompt || ""
      }));
      return mergeExperts(BUILTIN_EXPERTS, migratedCustom);
    }

    // Migration from old format
    const oldConfig = localStorage.getItem("kkimage_expert_config");
    if (oldConfig) {
      const parsed = JSON.parse(oldConfig);
      const migrated: ExpertDef[] = JSON.parse(JSON.stringify(BUILTIN_EXPERTS));
      // Add non-default styles from old config as custom styles to VISIO
      if (parsed.styles) {
        const flowchart = migrated.find((e) => e.id === "flowchart")!;
        for (const s of parsed.styles) {
          if (!s.isDefault) {
            flowchart.styles.push({ ...s, isDefault: false });
          }
        }
      }
      localStorage.setItem("kkimage_experts", JSON.stringify(stripBuiltins(migrated)));
      localStorage.removeItem("kkimage_expert_config");
      localStorage.setItem("kkimage_expert_version", "v2");
      return migrated;
    }
  } catch (e) {
    console.error("Failed to load experts:", e);
  }
  return JSON.parse(JSON.stringify(BUILTIN_EXPERTS));
}

export function saveExperts(experts: ExpertDef[]) {
  try {
    localStorage.setItem("kkimage_experts", JSON.stringify(stripBuiltins(experts)));
  } catch (e) {
    console.error("Failed to save experts:", e);
  }
}

/** Strip default styles and base prompts from built-in experts if they are unmodified, to keep JSON size small */
function stripBuiltins(experts: ExpertDef[]): ExpertDef[] {
  return experts.map((e) => {
    if (e.isBuiltIn) {
      const builtinExpert = BUILTIN_EXPERTS.find((be) => be.id === e.id);
      const stylesToSave = e.styles.filter((s) => {
        if (!s.isDefault) return true; // Always save custom styles
        const builtinStyle = builtinExpert?.styles.find((bs) => bs.id === s.id);
        if (!builtinStyle) return false;
        // Only save default style if it has been modified
        return s.prompt !== builtinStyle.prompt || s.name !== builtinStyle.name;
      });
      return {
        ...e,
        basePrompt: e.basePrompt === builtinExpert?.basePrompt ? "" : e.basePrompt,
        styles: stylesToSave,
      };
    }
    return e;
  });
}

/** Merge built-in experts (with full default styles) + stored custom data */
function mergeExperts(builtins: ExpertDef[], stored: ExpertDef[]): ExpertDef[] {
  const result: ExpertDef[] = JSON.parse(JSON.stringify(builtins));
  for (const s of stored) {
    const existing = result.find((e) => e.id === s.id);
    if (existing && existing.isBuiltIn) {
      // Restore customized basePrompt if it was modified
      if (s.basePrompt) {
        existing.basePrompt = s.basePrompt;
      }
      // Merge styles
      for (const style of s.styles) {
        const existingStyle = existing.styles.find((es) => es.id === style.id);
        if (existingStyle) {
          // If style exists (meaning it's a default style), update with customized values
          existingStyle.prompt = style.prompt;
          existingStyle.name = style.name;
        } else {
          // Custom style
          existing.styles.push(style);
        }
      }
    } else if (!existing) {
      // Custom expert
      result.push({
        ...s,
        basePrompt: s.basePrompt || "",
      });
    }
  }
  return result;
}

export function getExpertById(experts: ExpertDef[], id: string): ExpertDef | undefined {
  return experts.find((e) => e.id === id);
}

// ========================
// SVG Icons
// ========================

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconPlus = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

const IconTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
  </svg>
);

const IconLock = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

// ========================
// Hint text per expert type
// ========================

function getHintForExpert(expert: ExpertDef): string {
  if (expert.id === "flowchart") {
    return "在下方编辑框配置流程图/泳道图排版规则。生成时将与视觉流派和 Mermaid 代码合并。";
  }
  if (expert.id === "sequence") {
    return "在下方编辑框配置时序图排版规则。生成时将与视觉流派和 Mermaid 代码合并。";
  }
  if (expert.id === "arch") {
    return "在下方编辑框配置系统架构图排版规则。生成时将与视觉流派和 Mermaid 代码合并。";
  }
  if (expert.id === "ppt") {
    return "在下方编辑框配置 PPT 页面排版规则。生成时将与视觉流派和 Mermaid 代码合并。";
  }
  return "在下方编辑框配置图表基础排版规则。生成时将与选择的视觉流派和 Mermaid 代码合并。";
}

// ========================
// Component
// ========================

export function ExpertModal({ isOpen, onClose, experts, activeExpertId, onSave }: ExpertModalProps) {
  const [localExperts, setLocalExperts] = useState<ExpertDef[]>([]);
  const [selectedExpertId, setSelectedExpertId] = useState<string>(activeExpertId);
  const [activeStyleId, setActiveStyleId] = useState<string>("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newExpertName, setNewExpertName] = useState("");
  const [newExpertDesc, setNewExpertDesc] = useState("");

  // Sync state when opened
  useEffect(() => {
    if (isOpen) {
      setLocalExperts(JSON.parse(JSON.stringify(experts)));
      setSelectedExpertId(activeExpertId || experts[0]?.id || "flowchart");
      const expert = experts.find((e) => e.id === (activeExpertId || experts[0]?.id));
      setActiveStyleId(expert?.styles[0]?.id || "");
      setShowCreateDialog(false);
    }
  }, [experts, activeExpertId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const selectedExpert = localExperts.find((e) => e.id === selectedExpertId) || localExperts[0];
  const activeStyle = selectedExpert?.styles.find((s) => s.id === activeStyleId) || selectedExpert?.styles[0];

  // Auto-select first style when expert changes
  useEffect(() => {
    if (selectedExpert && selectedExpert.styles.length > 0) {
      if (!selectedExpert.styles.find((s) => s.id === activeStyleId)) {
        setActiveStyleId(selectedExpert.styles[0].id);
      }
    }
  }, [selectedExpertId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStyleNameChange = (name: string) => {
    setLocalExperts((prev) =>
      prev.map((e) =>
        e.id === selectedExpertId
          ? { ...e, styles: e.styles.map((s) => (s.id === activeStyleId ? { ...s, name } : s)) }
          : e
      )
    );
  };

  const handleStylePromptChange = (prompt: string) => {
    setLocalExperts((prev) =>
      prev.map((e) =>
        e.id === selectedExpertId
          ? { ...e, styles: e.styles.map((s) => (s.id === activeStyleId ? { ...s, prompt } : s)) }
          : e
      )
    );
  };

  const handleAddStyle = () => {
    const newId = crypto.randomUUID?.() ?? `style-${Date.now()}-${Math.random()}`;
    const newStyle: StylePreset = {
      id: newId,
      name: "自定义流派",
      prompt: `请输入自定义的生图提示词，引导 AI 按照您期望的风格生成图像。`,
      isDefault: false,
    };
    setLocalExperts((prev) =>
      prev.map((e) =>
        e.id === selectedExpertId ? { ...e, styles: [...e.styles, newStyle] } : e
      )
    );
    setActiveStyleId(newId);
  };

  const handleDeleteStyle = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    if (confirm("确定删除这个自定义流派吗？")) {
      setLocalExperts((prev) =>
        prev.map((exp) =>
          exp.id === selectedExpertId
            ? { ...exp, styles: exp.styles.filter((s) => s.id !== idToDelete) }
            : exp
        )
      );
      if (activeStyleId === idToDelete) {
        const remaining = selectedExpert?.styles.filter((s) => s.id !== idToDelete);
        setActiveStyleId(remaining?.[0]?.id || "");
      }
    }
  };

  const handleCreateExpert = () => {
    if (!newExpertName.trim()) return;
    const newId = crypto.randomUUID?.() ?? `expert-${Date.now()}-${Math.random()}`;
    const defaultStyleId = crypto.randomUUID?.() ?? `style-${Date.now()}`;
    const newExpert: ExpertDef = {
      id: newId,
      name: newExpertName.trim(),
      description: newExpertDesc.trim() || "自定义专家",
      isBuiltIn: false,
      basePrompt: "请输入自定义图表类型的排版对齐与连线规范...",
      styles: [
        {
          id: defaultStyleId,
          name: "默认流派",
          prompt: "请输入自定义的色彩与视觉流派提示词...",
          isDefault: false,
        },
      ],
    };
    setLocalExperts((prev) => [...prev, newExpert]);
    setSelectedExpertId(newId);
    setActiveStyleId(defaultStyleId);
    setShowCreateDialog(false);
    setNewExpertName("");
    setNewExpertDesc("");
  };

  const handleDeleteExpert = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    const expert = localExperts.find((x) => x.id === idToDelete);
    if (!expert || expert.isBuiltIn) return;
    if (confirm(`确定删除专家「${expert.name}」及其所有流派吗？`)) {
      const filtered = localExperts.filter((x) => x.id !== idToDelete);
      setLocalExperts(filtered);
      if (selectedExpertId === idToDelete) {
        setSelectedExpertId(filtered[0]?.id || "flowchart");
      }
    }
  };

  const handleRestoreDefaults = () => {
    if (confirm("确定要恢复默认预置提示词吗？这将覆盖您对内置专家和流派的修改。")) {
      const freshBuiltins = JSON.parse(JSON.stringify(BUILTIN_EXPERTS));
      const customOnly = localExperts.filter((e) => !e.isBuiltIn);
      const resetList = [...freshBuiltins, ...customOnly];
      
      setLocalExperts(resetList);
      
      // If the currently selected expert is no longer in the list, fallback
      if (!resetList.some((e) => e.id === selectedExpertId)) {
        setSelectedExpertId(resetList[0]?.id || "flowchart");
      }
      
      alert("已恢复默认提示词（点击下方“应用并保存”后正式生效）");
    }
  };

  const handleSave = () => {
    onSave(localExperts, activeStyleId || "");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card expert-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>专家预置提示词</h2>
          <button className="btn-icon" onClick={onClose}>
            <IconX />
          </button>
        </div>

        <div className="expert-body">
          {/* Left sidebar: expert list */}
          <div className="expert-sidebar">
            {localExperts.map((expert) => (
              <div
                key={expert.id}
                className={`expert-sidebar-item ${selectedExpertId === expert.id ? "active" : ""}`}
                onClick={() => setSelectedExpertId(expert.id)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, minWidth: 0 }}>
                  {expert.isBuiltIn && (
                    <span style={{ flexShrink: 0, opacity: 0.5, display: "flex" }}><IconLock /></span>
                  )}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {expert.name}
                  </span>
                </span>
                {!expert.isBuiltIn && (
                  <button
                    className="expert-sidebar-delete"
                    onClick={(e) => handleDeleteExpert(e, expert.id)}
                    title="删除此专家"
                  >
                    <IconTrash />
                  </button>
                )}
              </div>
            ))}

            <button
              className="expert-sidebar-add-btn"
              onClick={() => setShowCreateDialog(true)}
            >
              <IconPlus />
              <span>新建专家</span>
            </button>
          </div>

          {/* Middle column: style list for selected expert */}
          <div className="expert-middle-column">
            <div className="style-list-header">
              {selectedExpert?.name || ""} — 设计流派
            </div>
            <div className="style-list">
              {(selectedExpert?.styles || []).map((style) => (
                <div
                  key={style.id}
                  className={`style-item ${activeStyleId === style.id ? "active" : ""}`}
                  onClick={() => setActiveStyleId(style.id)}
                >
                  <span className="style-item-name">{style.name}</span>
                  {!style.isDefault && (
                    <button
                      className="style-item-delete-btn"
                      onClick={(e) => handleDeleteStyle(e, style.id)}
                      title="删除此流派"
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="add-style-btn" onClick={handleAddStyle}>
              <IconPlus />
              <span>新建自定义流派</span>
            </button>
          </div>

          {/* Right column: style editor */}
          <div className="expert-right-column">
            <h3>排版与设计流派编辑</h3>

            {/* Expert description */}
            {selectedExpert && (
              <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "-8px" }}>
                {selectedExpert.isBuiltIn ? (
                  <span style={{ fontStyle: "italic" }}>{selectedExpert.description}</span>
                ) : (
                  <input
                    type="text"
                    className="style-name-input"
                    value={selectedExpert.description}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalExperts((prev) =>
                        prev.map((exp) =>
                          exp.id === selectedExpertId ? { ...exp, description: val } : exp
                        )
                      );
                    }}
                    placeholder="专家描述..."
                    style={{ marginBottom: "4px" }}
                  />
                )}
              </div>
            )}

            <p className="expert-hint">{selectedExpert ? getHintForExpert(selectedExpert) : ""}</p>

            {/* Expert Base Prompt Editor */}
            {selectedExpert && (
              <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "4px", marginBottom: "12px", flex: "none" }}>
                <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>专家基础排版规范 (Base Prompt)</label>
                <textarea
                  className="expert-code-textarea"
                  value={selectedExpert.basePrompt}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalExperts((prev) =>
                      prev.map((exp) =>
                        exp.id === selectedExpertId ? { ...exp, basePrompt: val } : exp
                      )
                    );
                  }}
                  placeholder="在此输入该图表类型的基础排版对齐与连线规范..."
                  style={{ height: "160px", flex: "none", fontSize: "12.5px", whiteSpace: "pre-wrap", resize: "vertical" }}
                />
              </div>
            )}

            {activeStyle ? (
              <div className="style-editor-form" style={{ flex: "none", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "none" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>流派名称</label>
                  <input
                    type="text"
                    className="style-name-input"
                    value={activeStyle.name}
                    onChange={(e) => handleStyleNameChange(e.target.value)}
                    placeholder="输入流派名称..."
                  />
                </div>

                <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "4px", flex: "none" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", fontWeight: 600 }}>流派生图提示词 (Style Prompt)</label>
                  <textarea
                    className="expert-code-textarea"
                    value={activeStyle.prompt}
                    onChange={(e) => handleStylePromptChange(e.target.value)}
                    placeholder="在此输入能够引导 AI 生成该流派的色彩、背景与材质指令..."
                    style={{ height: "220px", flex: "none", fontSize: "12.5px", whiteSpace: "pre-wrap", resize: "vertical" }}
                  />
                </div>
              </div>
            ) : (
              <div className="sidebar-empty">请选择或创建一个流派进行编辑</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={handleRestoreDefaults} style={{ marginRight: "auto" }}>
            恢复默认
          </button>
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={handleSave}>
            应用并保存
          </button>
        </div>

        {/* Create Expert Dialog */}
        {showCreateDialog && (
          <div className="expert-create-overlay" onClick={() => setShowCreateDialog(false)}>
            <div className="expert-create-dialog" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600 }}>新建自定义专家</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <input
                  type="text"
                  className="style-name-input"
                  value={newExpertName}
                  onChange={(e) => setNewExpertName(e.target.value)}
                  placeholder="专家名称（如：UML图专家、数据流图专家）"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateExpert(); }}
                />
                <input
                  type="text"
                  className="style-name-input"
                  value={newExpertDesc}
                  onChange={(e) => setNewExpertDesc(e.target.value)}
                  placeholder="专家描述（可选）"
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateExpert(); }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "16px" }}>
                <button className="btn-secondary" onClick={() => setShowCreateDialog(false)}>取消</button>
                <button className="btn-primary" onClick={handleCreateExpert} disabled={!newExpertName.trim()}>创建</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
