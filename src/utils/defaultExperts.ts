import type { ExpertDef, StylePreset } from "../components/ExpertModal";

// ========================
// Expert Base Layout Prompts
// ========================

export const FLOWCHART_LAYOUT = `【基础排版与布局规范】
1. 必须完全、精准地遵循输入的 Mermaid 代码所定义的节点、顺序、交互角色和连线逻辑，确保最终渲染的图示连线、拓扑关系、流转路径与输入的 Mermaid 源码完全一致，绝无遗漏、多余、反向或篡改。
2. 连接线必须是水平或垂直的直角折线（Orthogonal lines），严禁斜线、弧线或交叉重叠的无序曲线。
3. 线条末端必须有清晰锐利的指向箭头。
4. 起止节点统一为圆角矩形，普通步骤为直角矩形，条件判断为标准菱形。
5. 若为泳道图，泳道框（Lane boxes）必须横向或纵向水平对齐，泳道边界线清晰，各角色步骤在其泳道内排列整齐，严禁跨道重叠。
6. 所有文本内容（包括节点文字、连线标签）必须极其清晰、高对比度、极其易读。文字居中，不与图形或连线重叠。`;

export const SEQUENCE_LAYOUT = `【基础排版与布局规范】
1. 必须完全、精准地遵循输入的 Mermaid 代码所定义的节点、顺序、交互角色和连线逻辑。
2. 参与者/对象方框在顶部横向排齐对齐，下方延伸出垂直虚线作为生命线（Lifelines）。
3. 交互消息传递线使用带箭头的水平线（实线为请求/调用，虚线为返回/答复），线段必须完全水平，严禁倾斜。
4. 生命线上的激活矩形块（Activation boxes）定位必须精准，长度和时间范围严格吻合，避免重叠或断开。
5. 循环（Loop）和分支选择（Alt/Opt）块的框体边界线清晰，文本标签在左上角对齐，内部缩进对齐规范。
6. 所有文本（参与者名称、消息内容）清晰可读，不与连线和激活块重叠。`;

export const ARCH_LAYOUT = `【基础排版与布局规范】
1. 采用清晰的分层布局：展示层（前端/客户端）位于顶层，服务层（微服务/API）位于中间层，数据层（数据库/缓存/消息队列）位于底层。
2. 每个服务/组件使用圆角矩形表示，同一层的组件横向等距排列，层与层之间保持充足间距。
3. 组件间调用关系使用带箭头的实线表示同步调用，虚线表示异步/消息通信，数据流向清晰。
4. 在连线旁标注协议类型（HTTP/gRPC/MQ）和端口号。
5. 负载均衡器、API 网关等核心中间件使用特殊形状（如六边形或梯形）区分。
6. 使用虚线边界框划分不同的功能区域或部署边界（如 VPC、K8s Namespace、子网），区域间间距合适。`;

export const PPT_LAYOUT = `【基础排版与布局规范】
1. 严格采用 16:9 比例的标准演示文稿（PPT）幻灯片页面布局。
2. 页面顶部通栏设置醒目的大标题，下方可带有较小字号的副标题作为解释。
3. 主体内容区域采用卡片化栅格排版，如 2列/3列/4列并排卡片或卡片网格，卡片间保持完美的水平和垂直间距。
4. 信息层级分明：重点数据、KPI 指标等使用极大字号突出显示，描述文字使用较小字号，避免大段长句，采用短句或符号列表形式。
5. 页面底端留出一致的安全边距，允许设置微小的页脚或分页信息，禁止文字和核心卡片拥挤在底部。`;

export const COMMON_LAYOUT = `【基础排版与布局规范】
1. 自动适配类图、状态图、甘特图、饼图等 Mermaid 图表的通用渲染规则。
2. 确保节点排列紧凑，间距均匀，信息层级分明。
3. 文本字迹清晰，无任何重叠或乱码。
4. 整体图表结构比例协调，符合逻辑思维图示。`;

// ========================
// Design Flow Prompts
// ========================

export const STYLE_CLASSIC_BLUE = `【设计流派与色彩规范】
1. 呈现极简、高端的 2D 扁平图表风格，严禁任何三维 3D 渲染、写实插图或杂乱的渐变阴影。
2. 背景必须是纯白色，提供最干净的阅读体验。
3. 节点填充颜色使用低饱和度的经典浅蓝色（如 HSL 210, 80%, 90%），边框为深蓝色，文字为黑色或深灰色。
4. 严禁使用任何 Emoji 表情符号或无意义的图标点缀。`;

export const STYLE_TECH_GRAY = `【设计流派与色彩规范】
1. 呈现极简、高端的 2D 扁平图表风格，严禁任何三维 3D 渲染、写实插图或杂乱的渐变阴影。
2. 背景必须是纯白色。
3. 节点填充颜色使用低饱和度的商务科技灰色（如 HSL 0, 0%, 92%），边框为深灰色，文字为黑色。
4. 严禁使用任何 Emoji 表情符号。`;

export const STYLE_PPT_CARD = `【设计流派与色彩规范】
1. 采用现代高端 PPT 商务设计风格，卡片/节点带有极轻微的微立体渐变填充（如从浅白到淡灰色，或柔和渐变色）以及极细致的柔和模糊阴影（Soft Drop Shadow）以增加质感和悬浮感。
2. 纯白或浅灰色极简纸张背景。
3. 边框使用极细的浅灰色，或取消边框直接采用微弱投影来区隔节点。
4. 核心高光指标可使用高饱和主色渐变填充（如 HSL 210, 85%, 60% 到 HSL 230, 85%, 55%），文字根据背景选择深灰或纯白，具备顶级的视觉层次感。
5. 严禁使用任何 Emoji 表情符号。`;

export const STYLE_DEEP_DARK = `【设计流派与色彩规范】
1. 呈现充满未来科技感的深色暗黑风格。
2. 背景使用深暗灰色系（如 HSL 220, 20%, 12% 或 HSL 220, 24%, 8%），提供舒适的护眼体验。
3. 节点和线框使用半透明的暗色填充，搭配高亮霓虹发光边框（如亮青色 HSL 180, 80%, 55% 或亮蓝色）。
4. 连线使用亮青色、亮绿或亮橙色发光线段，箭头清晰明亮.
5. 文本使用白色、亮蓝色或淡青色（高对比度），确保在暗色背景下极致清晰。
6. 严禁使用任何 Emoji 表情符号。`;

export const STYLE_SKETCH = `【设计流派与色彩规范】
1. 呈现亲切、自然的手绘草图（Sketch/Hand-drawn）风格，模拟白板手绘的有机感。
2. 背景为粗糙白色纸张或白板底色。
3. 所有节点边框和连接线必须呈现出波浪形、不规则的手绘粗线条效果（Wavy/Jagged lines），模拟手持画笔的手绘抖动笔触，严禁完美的直线和圆形。
4. 阴影使用手绘平行斜线或交叉网格斜线（Hatching/Cross-hatching）填充。
5. 字体样式统一模拟手写字体（Handwriting font），字迹自然随性。
6. 配色使用类似黑/蓝墨水的手画单色，核心强调部分可用红色马克笔进行手绘填充。
7. 严禁使用任何 Emoji 表情符号。`;

export const STYLE_MINIMAL_BW = `【设计流派与色彩规范】
1. 呈现最高可读性、最纯粹的极简黑白纸张风格。
2. 背景为绝对纯白色。
3. 所有节点和卡片填充为纯白色背景（无色彩），边框为 1px 的纤细黑色实线，无任何投影、渐变或发光。
4. 连线和箭头均为黑色实线/虚线。
5. 文字为纯黑色，使用无衬线字体。
6. 没有任何多余的视觉干扰，专注于图表本身逻辑结构。
7. 严禁使用任何 Emoji 表情符号。`;

// ========================
// Built-in Experts (constants)
// ========================

export const BUILTIN_STYLES: StylePreset[] = [
  { id: "classic-blue", name: "微软经典蓝 (Classic Blue)", prompt: STYLE_CLASSIC_BLUE, isDefault: true },
  { id: "tech-gray", name: "商务科技灰 (Tech Gray)", prompt: STYLE_TECH_GRAY, isDefault: true },
  { id: "ppt-card", name: "PPT商务微立体 (PPT Premium)", prompt: STYLE_PPT_CARD, isDefault: true },
  { id: "deep-dark", name: "暗黑霓虹风 (Deep Dark)", prompt: STYLE_DEEP_DARK, isDefault: true },
  { id: "sketch", name: "手绘草图风 (Sketch Style)", prompt: STYLE_SKETCH, isDefault: true },
  { id: "minimal-bw", name: "极简纯黑白 (Minimal B&W)", prompt: STYLE_MINIMAL_BW, isDefault: true },
];

export const BUILTIN_EXPERTS: ExpertDef[] = [
  {
    id: "flowchart",
    name: "流程图/泳道图专家",
    description: "专注于流程控制、业务步骤和角色泳道的精细化布局排版",
    isBuiltIn: true,
    basePrompt: FLOWCHART_LAYOUT,
    styles: BUILTIN_STYLES,
  },
  {
    id: "sequence",
    name: "时序图专家",
    description: "专注于系统交互、消息流转及对象生命周期的时序化对齐排版",
    isBuiltIn: true,
    basePrompt: SEQUENCE_LAYOUT,
    styles: BUILTIN_STYLES,
  },
  {
    id: "arch",
    name: "系统架构图专家",
    description: "专注于多层微服务架构、子网部署边界及数据流向的多维层次排版",
    isBuiltIn: true,
    basePrompt: ARCH_LAYOUT,
    styles: BUILTIN_STYLES,
  },
  {
    id: "ppt",
    name: "PPT演示页面专家",
    description: "专注于 16:9 比例的演示卡片、大字号核心指标及幻灯片的高端排版",
    isBuiltIn: true,
    basePrompt: PPT_LAYOUT,
    styles: BUILTIN_STYLES,
  },
  {
    id: "common",
    name: "通用图表专家",
    description: "适配类图、状态图、甘特图、饼图等常规 Mermaid 图表的可读性优化",
    isBuiltIn: true,
    basePrompt: COMMON_LAYOUT,
    styles: BUILTIN_STYLES,
  },
];
