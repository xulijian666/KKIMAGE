import { useEffect, useState } from "react";

export interface StylePreset {
  id: string;
  name: string;
  prompt: string;
  isDefault?: boolean;
}

export interface ExpertConfig {
  activeStyleId: string;
  styles: StylePreset[];
}

interface ExpertModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ExpertConfig;
  onSave: (config: ExpertConfig) => void;
}

const BLUE_PROMPT = `绘制一个标准的专业图表，整体设计要求与微软 VISIO 风格保持高度一致。

【核心排版逻辑与连线规范】
1. 必须完全、精准地遵循输入的 Mermaid 代码所定义的节点、顺序、交互角色和连线逻辑，确保最终渲染的图示连线、拓扑关系、流转路径与输入的 Mermaid 源码完全一致，绝无遗漏、多余、反向或篡改。
2. 如果是流程图：
   - 连接线必须是水平或垂直的直角折线（Orthogonal lines），严禁斜线、弧线或交叉重叠的无序曲线。
   - 线条末端必须有清晰锐利的标准指向箭头，确保指向正确的下游节点。
   - 起止节点统一为圆角矩形，普通步骤为直角矩形，条件判断为标准菱形。
3. 如果是时序图：
   - 参与者/对象方框在顶部横向排齐对齐，下方延伸出垂直虚线作为生命线（Lifelines）。
   - 交互消息传递线使用带箭头的水平线（实线为请求/调用，虚线为返回/答复），线段必须完全水平，严禁倾斜。
   - 生命线上的激活矩形块（Activation boxes）定位必须精准，长度和时间范围严格吻合。
   
【文字与可读性要求】
1. 所有文本内容（包括节点文字、连线标签、参与者名称）必须极其清晰、高分辨率、高对比度、极其易读。
2. 严禁出现拼写混乱、字符丢失、模糊、边缘毛糙或文字与节点/连线重叠的情况。
3. 文字使用标准的扁平化无衬线系统字体（如 Arial 或 Segoe UI），在节点或线条上方居中对齐，大小适中。

【色彩与平面视觉风格】
1. 呈现极简、高端的 2D 扁平图表风格，严禁任何三维 3D 渲染、写实插图或杂乱的渐变阴影。
2. 背景必须是纯白底，提供最干净的阅读体验。
3. 节点填充颜色使用低饱和度的经典 VISIO 浅蓝色（例如 HSL 210, 80%, 90%），边框为深蓝色，文字为黑色或深灰色。
4. 严禁使用任何 Emoji 表情符号或无意义的图标点缀。`;

const GRAY_PROMPT = `绘制一个标准的专业图表，整体设计要求与微软 VISIO 风格保持高度一致。

【核心排版逻辑与连线规范】
1. 必须完全、精准地遵循输入的 Mermaid 代码所定义的节点、顺序、交互角色和连线逻辑，确保最终渲染的图示连线、拓扑关系、流转路径与输入的 Mermaid 源码完全一致，绝无遗漏、多余、反向或篡改。
2. 如果是流程图：
   - 连接线必须是水平或垂直的直角折线（Orthogonal lines），严禁斜线、弧线或交叉重叠的无序曲线。
   - 线条末端必须有清晰锐利的标准指向箭头，确保指向正确的下游节点。
   - 起止节点统一为圆角矩形，普通步骤为直角矩形，条件判断为标准菱形。
3. 如果是时序图：
   - 参与者/对象方框在顶部横向排齐对齐，下方延伸出垂直虚线作为生命线（Lifelines）。
   - 交互消息传递线使用带箭头的水平线（实线为请求/调用，虚线为返回/答复），线段必须完全水平，严禁倾斜。
   - 生命线上的激活矩形块（Activation boxes）定位必须精准，长度和时间范围严格吻合。
   
【文字与可读性要求】
1. 所有文本内容（包括节点文字、连线标签、参与者名称）必须极其清晰、高分辨率、高对比度、极其易读。
2. 严禁出现拼写混乱、字符丢失、模糊、边缘毛糙或文字与节点/连线重叠的情况。
3. 文字使用标准的扁平化无衬线系统字体（如 Arial 或 Segoe UI），在节点或线条上方居中对齐，大小适中。

【色彩与平面视觉风格】
1. 呈现极简、高端的 2D 扁平图表风格，严禁任何三维 3D 渲染、写实插图或杂乱的渐变阴影。
2. 背景必须是纯白底，提供最干净的阅读体验。
3. 节点填充颜色使用低饱和度的商务科技灰色（例如 HSL 0, 0%, 92%），边框为深灰色，文字为黑色。
4. 严禁使用任何 Emoji 表情符号或无意义的图标点缀。`;

const BW_PROMPT = `绘制一个标准的专业图表，整体设计要求与微软 VISIO 风格保持高度一致。

【核心排版逻辑与连线规范】
1. 必须完全、精准地遵循输入的 Mermaid 代码所定义的节点、顺序、交互角色和连线逻辑，确保最终渲染的图示连线、拓扑关系、流转路径与输入的 Mermaid 源码完全一致，绝无遗漏、多余、反向或篡改。
2. 如果是流程图：
   - 连接线必须是水平或垂直的直角折线（Orthogonal lines），严禁斜线、弧线或交叉重叠的无序曲线。
   - 线条末端必须有清晰锐利的标准指向箭头，确保指向正确的下游节点。
   - 起止节点统一为圆角矩形，普通步骤为直角矩形，条件判断为标准菱形。
3. 如果是时序图：
   - 参与者/对象方框在顶部横向排齐对齐，下方延伸出垂直虚线作为生命线（Lifelines）。
   - 交互消息传递线使用带箭头的水平线（实线为请求/调用，虚线为返回/答复），线段必须完全水平，严禁倾斜。
   - 生命线上的激活矩形块（Activation boxes）定位必须精准，长度和时间范围严格吻合。
   
【文字与可读性要求】
1. 所有文本内容（包括节点文字、连线标签、参与者名称）必须极其清晰、高分辨率、高对比度、极其易读。
2. 严禁出现拼写混乱、字符丢失、模糊、边缘毛糙或文字与节点/连线重叠的情况。
3. 文字使用标准的扁平化无衬线系统字体（如 Arial 或 Segoe UI），在节点或线条上方居中对齐，大小适中。

【色彩与平面视觉风格】
1. 呈现极简、高端的 2D 扁平图表风格，严禁任何三维 3D 渲染、写实插图或杂乱的渐变阴影。
2. 背景必须是纯白底，提供最干净的阅读体验。
3. 节点填充为纯白色背景（无填充），搭配细黑边框，文字为纯黑色。
4. 严禁使用任何 Emoji 表情符号或无意义的图标点缀。`;

const DEFAULT_STYLES: StylePreset[] = [
  {
    id: "blue",
    name: "微软经典蓝 (Classic Blue)",
    prompt: BLUE_PROMPT,
    isDefault: true,
  },
  {
    id: "gray",
    name: "商务科技灰 (Tech Gray)",
    prompt: GRAY_PROMPT,
    isDefault: true,
  },
  {
    id: "bw",
    name: "极简黑白 (Black & White)",
    prompt: BW_PROMPT,
    isDefault: true,
  },
];

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

export function ExpertModal({ isOpen, onClose, config, onSave }: ExpertModalProps) {
  const [styles, setStyles] = useState<StylePreset[]>([]);
  const [activeStyleId, setActiveStyleId] = useState<string>("blue");

  // Sync state with config prop when opened
  useEffect(() => {
    if (isOpen) {
      const initialStyles = config.styles && config.styles.length > 0 ? config.styles : DEFAULT_STYLES;
      setStyles(initialStyles);
      setActiveStyleId(config.activeStyleId || initialStyles[0].id);
    }
  }, [config, isOpen]);

  // Handle ESC closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const activeStyle = styles.find((s) => s.id === activeStyleId) || styles[0];

  const handleNameChange = (name: string) => {
    setStyles((prev) => prev.map((s) => (s.id === activeStyleId ? { ...s, name } : s)));
  };

  const handlePromptChange = (prompt: string) => {
    setStyles((prev) => prev.map((s) => (s.id === activeStyleId ? { ...s, prompt } : s)));
  };

  const handleAddStyle = () => {
    const newId = crypto.randomUUID?.() ?? `style-${Date.now()}-${Math.random()}`;
    const newStyle: StylePreset = {
      id: newId,
      name: "自定义图表风格",
      prompt: `绘制一个标准的专业图表，整体设计要求与微软 VISIO 风格保持高度一致。

【核心排版逻辑与连线规范】
1. 必须完全、精准地遵循输入的 Mermaid 代码所定义的节点、顺序、交互角色和连线逻辑，确保最终关系与源码完全一致。
2. 连线必须是水平或垂直的直角折线，文字必须清晰易读。`,
      isDefault: false,
    };
    setStyles((prev) => [...prev, newStyle]);
    setActiveStyleId(newId);
  };

  const handleDeleteStyle = (e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    if (confirm("确定删除这个自定义风格吗？")) {
      const filtered = styles.filter((s) => s.id !== idToDelete);
      setStyles(filtered);
      if (activeStyleId === idToDelete) {
        setActiveStyleId(filtered[0]?.id || "blue");
      }
    }
  };

  const handleSave = () => {
    onSave({
      activeStyleId,
      styles,
    });
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
          {/* 左侧栏：专家类别 */}
          <div className="expert-sidebar">
            <div className="expert-sidebar-item active">VISIO图专家</div>
            <div className="expert-sidebar-item disabled" title="更多专家敬请期待">
              更多专家...
            </div>
          </div>

          {/* 中间栏：风格主题列表 */}
          <div className="expert-middle-column">
            <div className="style-list-header">预置风格主题</div>
            <div className="style-list">
              {styles.map((style) => (
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
                      title="删除此风格"
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="add-style-btn" onClick={handleAddStyle}>
              <IconPlus />
              <span>新建自定义风格</span>
            </button>
          </div>

          {/* 右侧栏：风格参数编辑器 */}
          <div className="expert-right-column">
            <h3>风格属性编辑</h3>
            <p className="expert-hint">
              Mermaid 逻辑结构代码由您直接输入在主会话框中，生图时将与在此配置的风格提示词进行合并，以生成精美、逻辑精准对齐、文字高清晰度的专业 VISIO 风格图表。
            </p>

            {activeStyle ? (
              <div className="style-editor-form">
                <div className="form-group" style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>风格名称</label>
                  <input
                    type="text"
                    className="style-name-input"
                    value={activeStyle.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="输入风格名称..."
                  />
                </div>

                <div className="form-group" style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)" }}>风格生图提示词 (Style Prompt)</label>
                  <textarea
                    className="expert-code-textarea"
                    value={activeStyle.prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    placeholder="在此输入能够引导 AI 生成该风格的精细生图指令..."
                    style={{ whiteSpace: "pre-wrap" }}
                  />
                </div>
              </div>
            ) : (
              <div className="sidebar-empty">请选择或创建一个风格进行编辑</div>
            )}
          </div>
        </div>

        {/* 固定底部操作区，不随内容滚动 */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            取消
          </button>
          <button className="btn-primary" onClick={handleSave}>
            应用并保存
          </button>
        </div>
      </div>
    </div>
  );
}
