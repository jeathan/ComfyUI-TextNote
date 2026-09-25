/**
 * ComfyUI-TextNote v4.3 — 画布便签（纯正文 + 齿轮设置 + 界面语言自适应 + 超链接）
 *
 * 画布上只显示便签正文；所有参数收进右上角齿轮设置面板，面板在正文下方，
 * 边调边看不遮挡。无输入口/输出口，不参与执行；内容与设置随工作流 JSON 保存。
 *
 * v4.3 变更（单击编辑 + 光标落在点击处）：
 * - 单击正文任意位置即进入编辑，不再需要双击；光标直接落在你点的那个字上，
 *   不用再用方向键一点点挪（点正文最后一行下方的空白 = 光标到末尾）
 * - 按住拖动（挪节点等）不会误进编辑态；点超链接仍是打开链接，不进编辑
 *
 * v4.2 变更（占位提示不再写进正文）：
 * - 新建便签的正文默认为空字符串；「在这里写说明、备注…」等文案只是占位提示
 *   （textarea placeholder + 渲染层灰字），单击即可直接输入，无需先删掉提示文字
 * - 旧工作流里被当成正文保存过的占位提示，加载时自动识别并清空
 * - 顺带修好：齿轮设置面板展开时，正文预览区不再变成空白（面板在下方，本就不重叠）
 *
 * v4.1 变更（学习 MarkdownNote）：
 * - 正文支持超链接：[标题](URL) 与裸 URL 自动转可点击链接（下划线 + 链接色，新标签页打开）
 * - 顺带支持轻量 Markdown：# 标题 / - 列表 / **加粗**
 * - 非编辑态 = 渲染层（链接可点击）；编辑态 = textarea，失焦回到渲染层
 */
import { app } from "/scripts/app.js";

// ---------------- 界面语言 ----------------
const LANG = () => {
    const o = globalThis.__TEXTNOTE_LANG__;
    if (o === "zh" || o === "en") return o;
    const nav = (typeof navigator !== "undefined" && navigator.language) || "en";
    return String(nav).toLowerCase().startsWith("zh") ? "zh" : "en";
};

// defaultText = 空便签时的「占位提示」文案，只用于显示（渲染层灰字 / textarea placeholder），
// 绝不写入正文控件，因此双击编辑时不会出现需要先删掉的假文字
const I18N = {
    zh: {
        settings: "设置",
        font_size: "字号", align: "对齐", line_spacing: "行距",
        font_color: "文字颜色", bg_color: "背景颜色", border_color: "边框颜色",
        bold: "加粗", on: "开", off: "关",
        left: "左对齐", center: "居中", right: "右对齐",
        defaultText: "在这里写说明、备注…\n单击即可输入；支持 [标题](链接) 超链接",
        title: "📝 便签 TextNote",
    },
    en: {
        settings: "Settings",
        font_size: "Font size", align: "Align", line_spacing: "Line spacing",
        font_color: "Text color", bg_color: "Background color", border_color: "Border color",
        bold: "Bold", on: "On", off: "Off",
        left: "Left", center: "Center", right: "Right",
        defaultText: "Write notes here…\nClick to edit; [label](link) supported",
        title: "📝 TextNote (sticky note)",
    },
};
const t = (k) => (I18N[LANG()] && I18N[LANG()][k]) || I18N.en[k] || k;

// ---------------- 色板（hex 为存储值；zh/en 为显示名） ----------------
const FONT_COLORS = [
    { hex: "#F44336", zh: "大红", en: "Red" }, { hex: "#FF6D00", zh: "朱橙", en: "Tangerine" },
    { hex: "#FFAB00", zh: "橙", en: "Amber" }, { hex: "#FFEA00", zh: "柠檬黄", en: "Lemon" },
    { hex: "#AEEA00", zh: "草绿", en: "Lime" }, { hex: "#00E676", zh: "翠绿", en: "Emerald" },
    { hex: "#1DE9B6", zh: "青绿", en: "Teal" }, { hex: "#40C4FF", zh: "天蓝", en: "Sky" },
    { hex: "#536DFE", zh: "宝蓝", en: "Blue" }, { hex: "#B388FF", zh: "紫罗兰", en: "Violet" },
    { hex: "#FF4081", zh: "品红", en: "Magenta" }, { hex: "#F50057", zh: "玫红", en: "Rose" },
    { hex: "#FFFFFF", zh: "白", en: "White" }, { hex: "#000000", zh: "黑", en: "Black" },
];
// 背景：中等饱和度深色系（明度约 20–40%，饱和度约 30–60%）
const BG_COLORS = [
    { hex: "#24344D", zh: "藏青", en: "Navy" }, { hex: "#2E4A7A", zh: "墨蓝", en: "Ink blue" },
    { hex: "#33518F", zh: "靖蓝", en: "Cobalt" }, { hex: "#1F6E72", zh: "孔雀蓝", en: "Peacock" },
    { hex: "#2E6B5E", zh: "青碧", en: "Pine teal" }, { hex: "#2F5D3A", zh: "松柏绿", en: "Pine" },
    { hex: "#5A6B3A", zh: "苔绿", en: "Moss" }, { hex: "#8A6E3A", zh: "姜饼", en: "Ginger" },
    { hex: "#8A5A2E", zh: "赭石", en: "Ochre" }, { hex: "#5C4632", zh: "焦茶", en: "Coffee" },
    { hex: "#6B2D3E", zh: "酒红", en: "Wine" }, { hex: "#8A4A5E", zh: "玫褐", en: "Mulberry" },
    { hex: "#5C3A6E", zh: "绛紫", en: "Plum" }, { hex: "#47355C", zh: "茄紫", en: "Eggplant" },
    { hex: "#8A4A4A", zh: "珊瑚暗", en: "Coral dark" }, { hex: "#2E5555", zh: "墨青", en: "Dark teal" },
];
const BORDER_COLORS = [
    { hex: "transparent", zh: "无/隐形", en: "None" }, { hex: "#FFFFFF", zh: "纯白", en: "White" },
    { hex: "#D5D5D2", zh: "浅灰", en: "Light gray" }, { hex: "#A9A69E", zh: "中灰", en: "Gray" },
    { hex: "#4B4A47", zh: "深灰", en: "Dark gray" }, { hex: "#262626", zh: "炭黑", en: "Charcoal" },
    { hex: "#B3A99A", zh: "灰驼", en: "Camel" }, { hex: "#C9AFAA", zh: "雾粉", en: "Dusty pink" },
    { hex: "#AD928D", zh: "豆沙", en: "Mauve" }, { hex: "#9AAABB", zh: "雾蓝", en: "Mist blue" },
    { hex: "#72879A", zh: "雾霾蓝", en: "Slate blue" }, { hex: "#93A38F", zh: "灰绿", en: "Sage" },
    { hex: "#7F8770", zh: "橄榄绿", en: "Olive" }, { hex: "#A395A3", zh: "雾紫", en: "Dusty violet" },
    { hex: "#B9A076", zh: "姜黄", en: "Turmeric" }, { hex: "#E8E2D6", zh: "旧粉白", en: "Bone" },
];

const ALIGN_OPTIONS = ["left", "center", "right"];

const paletteFor = (rowKey) =>
    rowKey === "bg_color" ? BG_COLORS : rowKey === "border_color" ? BORDER_COLORS : FONT_COLORS;
const colorName = (hex, palette) => {
    const c = palette.find((x) => x.hex === hex);
    return c ? c[LANG()] || c.en : hex;
};

// ---------------- 富文本渲染（超链接 / 标题 / 列表 / 加粗） ----------------
// 学习 MarkdownNote：非编辑态把正文渲染为 HTML，链接带下划线、新标签页打开。
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/** 只放行安全协议；www. 开头自动补 https */
function safeHref(u) {
    const s = String(u || "").trim();
    if (/^(https?:|mailto:|ftp:)/i.test(s)) return s;
    if (/^www\./i.test(s)) return "https://" + s;
    return null;   // 拦截 javascript: / data: 等危险协议
}

function _anchor(labelHtml, href) {
    return `<a href="${escapeHtml(href)}" title="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer"`
        + ` style="color:#8EC2FF;text-decoration:underline;text-underline-offset:2px;pointer-events:auto;cursor:pointer">${labelHtml}</a>`;
}

function _bold(escapedText) {
    return escapedText.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
}

/** 行内渲染：[标题](URL) / 裸 URL / **加粗**（先分词再转义，防 XSS） */
function renderInline(raw) {
    const RE = /\[([^\]\n]+)\]\(([^)\s]+)\)|(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/g;
    let out = "", last = 0, m;
    while ((m = RE.exec(raw))) {
        out += _bold(escapeHtml(raw.slice(last, m.index)));
        if (m[1] !== undefined) {
            const href = safeHref(m[2]);
            out += href ? _anchor(escapeHtml(m[1]), href)
                        : escapeHtml(`[${m[1]}](${m[2]})`);
        } else {
            const u = m[0];
            out += _anchor(escapeHtml(u), u.startsWith("www.") ? "https://" + u : u);
        }
        last = m.index + m[0].length;
    }
    out += _bold(escapeHtml(raw.slice(last)));
    return out;
}

/** 整段渲染：# 标题 / - 列表 / 空行间距 / 段落；空文本只显示灰色占位提示 */
function renderRichText(text) {
    const raw = String(text ?? "");
    // 空便签：灰字提示（pre-wrap 保留换行），它只是提示，不参与正文
    if (!raw.trim())
        return `<div style="opacity:.45;white-space:pre-wrap">${escapeHtml(t("defaultText"))}</div>`;
    const parts = [];
    for (const line of raw.split(/\r?\n/)) {
        if (!line.trim()) { parts.push(`<div style="height:0.5em"></div>`); continue; }
        const h = line.match(/^\s{0,3}(#{1,4})\s+(.*)$/);
        if (h) {
            const size = ["1.5em", "1.3em", "1.15em", "1.05em"][h[1].length - 1];
            parts.push(`<div style="font-weight:700;font-size:${size};margin:2px 0">${renderInline(h[2])}</div>`);
            continue;
        }
        const b = line.match(/^\s*[-*•]\s+(.*)$/);
        if (b) {
            parts.push(`<div style="padding-left:1.1em;text-indent:-0.7em">${renderInline("• " + b[1])}</div>`);
            continue;
        }
        parts.push(`<div>${renderInline(line)}</div>`);
    }
    return parts.join("") || `<div></div>`;
}

// ---------------- 占位提示（只提示，不进正文） ----------------
/** 归一化：统一换行、去首尾空白，用于识别「被当成正文存下来的占位提示」 */
function normalizeNoteText(s) {
    return String(s ?? "").replace(/\r\n?/g, "\n").trim();
}

/** 历史上曾被写进正文默认值的占位文案；加载旧工作流时按此表清空。
 *  这些都是「真被当成正文存过」的历史字面量，因此独立于 I18N 冻结在此，不再随界面文案变动
 *  —— 例如 v4.3 把提示改成了「单击即可输入」，这里仍保留 v4.1/v4.2 的「双击编辑」那一版。 */
const LEGACY_PLACEHOLDER_TEXTS = new Set([
    "在这里写说明、备注…",                                              // v3 / v4.0 中文
    "Write notes and remarks here",                                     // v4.0 英文
    "在这里写说明、备注…\n双击编辑；支持 [标题](链接) 超链接",              // v4.1–v4.2 中文
    "Write notes here…\nDouble-click to edit; [label](link) supported",  // v4.1–v4.2 英文
].map(normalizeNoteText));

/** textarea 的 placeholder 颜色跟随正文色（Chrome 默认灰在深色便签上偏暗） */
const PLACEHOLDER_STYLE_ID = "textnote-placeholder-style";
function ensurePlaceholderStyle() {
    if (typeof document === "undefined" || !document.head ||
        typeof document.getElementById !== "function") return;
    if (document.getElementById(PLACEHOLDER_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = PLACEHOLDER_STYLE_ID;
    style.textContent = "textarea.tn-textnote-input::placeholder{color:currentColor;opacity:.45}";
    document.head.appendChild(style);
}

const GEAR = "\u2699";       // ⚙
const CLOSE = "\u2715";      // ✕

// 单击正文进编辑：按下与抬起位置相差超过这个像素数就当作拖动，不进编辑
const CLICK_DRAG_TOLERANCE = 4;

// 设置面板布局常量
const PANEL_ROW_H = 24;
const PANEL_HEADER_H = 26;
const PANEL_PAD = 8;
const PANEL_GAP = 10;      // 面板与正文预览区的间距
const GEAR_W = 22;

// 颜色下拉色卡
const MENU_COLS = 4;
const MENU_CELL_W = 88;
const MENU_CELL_H = 22;
const MENU_HEADER = 18;
const MENU_PAD = 5;
const MENU_SELECTED = "#E8C84A";
// 使用下拉色卡选择的行
const MENU_ROWS = ["font_color", "bg_color", "border_color"];

// 数值行（− / 数字 / ＋ 三区点击）配置
const NUM_ROWS = {
    font_size: { min: 8, max: 128, step: 2, int: true },
    line_spacing: { min: 0.8, max: 3, step: 0.1, int: false },
};

// 面板行定义（控件名 = 存储键，显示名经 i18n）
const PANEL_ROWS = ["font_size", "align", "line_spacing", "font_color", "bg_color", "border_color", "bold"];

// ---------------- 旧版（v3.x 中文存储）迁移表 ----------------
const LEGACY_WIDGET_KEYS = {
    "字号": "font_size", "对齐": "align", "行距": "line_spacing",
    "文字颜色": "font_color", "背景颜色": "bg_color", "边框颜色": "border_color", "加粗": "bold",
};
const LEGACY_ALIGN = { "左对齐": "left", "居中": "center", "右对齐": "right" };
const LEGACY_FONT_COLORS = {
    "大红": "#F44336", "朱橙": "#FF6D00", "橙": "#FFAB00", "柠檬黄": "#FFEA00",
    "草绿": "#AEEA00", "翠绿": "#00E676", "青绿": "#1DE9B6", "天蓝": "#40C4FF",
    "宝蓝": "#536DFE", "紫罗兰": "#B388FF", "品红": "#FF4081", "玫红": "#F50057",
    "白": "#FFFFFF", "黑": "#000000", "纸白": "#ECEFF1", "暖白": "#F5E9D9",
    "亮黄": "#FFE082", "薄荷": "#A5F0DC", "粉红": "#F8BBD0", "中灰": "#B0BEC5",
    "墨黑": "#333333", "纯黑": "#111111", "深红": "#B71C1C", "橘橙": "#E65100",
    "暗金": "#827717", "深绿": "#1B5E20", "青蓝": "#006064", "深紫": "#4A148C",
};
const LEGACY_BG_COLORS = {
    "石墨黑": "#1E1E1E", "炭黑": "#262626", "深灰蓝": "#1F2A33", "墨绿": "#1B2C24",
    "深酒红": "#2C1B22", "深棕": "#2A241B", "深紫": "#241B2C", "午夜蓝": "#151E2E",
    "纯白": "#FFFFFF", "米白": "#F2EDE4", "浅灰": "#E3E3E0", "暖灰": "#CCC7BE",
    "中灰": "#A9A69E", "深灰": "#4B4A47", "燕麦": "#D8CFC0", "雾粉": "#D8C0BC",
    "豆沙": "#C2A6A1", "雾蓝": "#AEBBC8", "雾霾蓝": "#8A9BAA", "灰绿": "#A8B5A4",
    "雾紫": "#B4A8B4", "姜黄": "#CDB083", "橄榄绿": "#8F9779",
    "便签黄": "#FFF9C4", "浅粉": "#FFEBEE", "浅绿": "#E8F5E9", "浅蓝": "#E3F2FD",
    "浅紫": "#F3E5F5", "浅橙": "#FFF3E0", "浅青": "#E0F2F1", "纯黑": "#1A1A1A",
    "墨蓝": "#2E4A7A", "藏青": "#24344D", "靖蓝": "#33518F", "孔雀蓝": "#1F6E72",
    "青碧": "#2E6B5E", "松柏绿": "#2F5D3A", "苔绿": "#5A6B3A", "姜饼": "#8A6E3A",
    "赭石": "#8A5A2E", "焦茶": "#5C4632", "酒红": "#6B2D3E", "玫褐": "#8A4A5E",
    "绛紫": "#5C3A6E", "茄紫": "#47355C", "珊瑚暗": "#8A4A4A", "墨青": "#2E5555",
};
const LEGACY_BORDER_COLORS = {
    "无/隐形": "transparent", "透明": "transparent",
    "浅灰": "#D5D5D2", "中灰": "#A9A69E", "深灰": "#4B4A47", "炭黑": "#262626",
    "纯白": "#FFFFFF", "灰驼": "#B3A99A", "雾粉": "#C9AFAA", "豆沙": "#AD928D",
    "雾蓝": "#9AAABB", "雾霾蓝": "#72879A", "灰绿": "#93A38F", "橄榄绿": "#7F8770",
    "雾紫": "#A395A3", "姜黄": "#B9A076", "旧粉白": "#E8E2D6",
    "便签黄边": "#E6D070", "红边": "#EF9A9A", "绿边": "#A5D6A7", "蓝边": "#90CAF9",
    "紫边": "#CE93D8", "橙边": "#FFCC80", "青边": "#80CBC4", "黑色": "#333333",
    "石墨": "#2C2C2C", "灰蓝": "#33475C", "暗金": "#5C4E33", "暗绿": "#33473B",
    "酒红": "#4A3038", "暗紫": "#3E334A",
};

app.registerExtension({
    name: "TextNote.CanvasNote",
    registerCustomNodes() {
        const LG = window.LiteGraph;
        if (!LG || !window.LGraphNode) {
            console.error("[TextNote] LiteGraph global not available; TextNote not registered");
            return;
        }

        class TextNoteNode extends window.LGraphNode {
            constructor() {
                super();
                if (!this.properties) this.properties = {};
                this.serialize_widgets = true;   // 正文 + 设置随工作流保存
                this.isVirtualNode = true;       // 纯注解：不参与执行
                this.color = "#4B4A47";          // 边框/标题色
                this.bgcolor = "#2E4A7A";        // 便签底色（墨蓝，中等饱和深色）
                this.size = [320, 180];
                this.settingsOpen = false;       // 运行时态，不序列化
                this.openMenu = null;            // 当前打开的下拉色卡所属行，运行时态
                this._editMode = false;          // 正文编辑态（双击进入，失焦退出）
                this._renderDiv = null;          // 渲染层 DOM（超链接等富文本）
                this._lastBodyClick = 0;

                const onChange = () => this.applyNoteStyles();
                const hide = (w) => {
                    w.hidden = true;
                    if (!w.options) w.options = {};
                    w.options.hidden = true;
                    return w;
                };
                const add = (type, name, value, options) =>
                    hide(this.addWidget(type, name, value, onChange, options || {}));

                // 正文：官方同款多行编辑区（唯一可见元素，即便签本体）。
                // hideOnZoom:false — 任何缩放级别都保持可见
                //（默认 true 会在 LOD 阈值约 57% 以下隐藏 DOM 编辑区）
                // 默认值必须是空字符串：提示文案只做占位显示（textarea placeholder + 渲染层灰字），
                // 否则用户双击编辑时会看到一段需要先删掉的假正文。
                // placeholder 由前端 createMultilineInputElement 原生写到 textarea 上。
                const CW = window.comfyAPI?.widgets?.ComfyWidgets;
                if (CW) {
                    this.textWidget = CW.STRING(
                        this, "text",
                        ["STRING", { default: "", multiline: true, placeholder: t("defaultText") }],
                        app,
                    ).widget;
                    this.textWidget.options.hideOnZoom = false;
                } else {
                    this.textWidget = this.addWidget("text", "text", "", onChange);
                    if (!this.textWidget.options) this.textWidget.options = {};
                    this.textWidget.options.hideOnZoom = false;
                }

                // 设置控件（隐藏；名称 = 语言无关存储键）
                add("combo", "font_size", "16", { values: ["12", "14", "16", "18", "22", "26", "32", "40", "52"] });
                add("combo", "align", "center", { values: ALIGN_OPTIONS });
                add("combo", "line_spacing", "1.4", { values: ["1.0", "1.2", "1.4", "1.6", "1.8", "2.0"] });
                add("combo", "font_color", "#FFFFFF", { values: FONT_COLORS.map((c) => c.hex) });
                add("combo", "bg_color", "#2E4A7A", { values: BG_COLORS.map((c) => c.hex) });
                add("combo", "border_color", "#4B4A47", { values: BORDER_COLORS.map((c) => c.hex) });
                add("toggle", "bold", false);

                this.applyNoteStyles();
                // 渲染层在 textarea 挂载后由 _syncRenderDiv 自愈创建；
                // 构造期 DOM 通常尚未挂载，不在此处强建
            }

            // ---------- 正文渲染层（超链接等富文本） ----------

            /** 正文区像素高度（显式值，避免 100% 在容器未定高时塌缩为 0） */
            _bodyHeightPx() {
                if (this.settingsOpen && this._previewH) return this._previewH;
                return Math.max(60, Math.round(this.size[1]) - 34);
            }

            /** 确保渲染层 div 存在、挂在 textarea 同父；未挂载时安全跳过（下帧重试） */
            _ensureRenderDiv() {
                const ta = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                if (!ta || typeof document === "undefined" || !ta.parentElement) return null;
                let div = this._renderDiv;
                if (!div) {
                    div = document.createElement("div");
                    this._renderDiv = div;
                }
                if (div.parentElement !== ta.parentElement) {
                    ta.parentElement.appendChild(div);
                }
                // 渲染层交互：单击进编辑（光标落在点击处）；链接只放行默认行为；拖动不进编辑
                if (!div.__tnBound && div.addEventListener) {
                    div.addEventListener("mousedown", (ev) => {
                        div.__tnDown = { x: ev.clientX, y: ev.clientY };
                    });
                    div.addEventListener("click", (ev) => {
                        const down = div.__tnDown;
                        div.__tnDown = null;
                        // 点在链接上：新标签页打开，不进编辑态
                        if (ev.target && ev.target.closest && ev.target.closest("a")) {
                            ev.stopPropagation();
                            return;
                        }
                        // 按住拖动（挪节点等）不算单击
                        if (down && (Math.abs(ev.clientX - down.x) > CLICK_DRAG_TOLERANCE ||
                                     Math.abs(ev.clientY - down.y) > CLICK_DRAG_TOLERANCE)) return;
                        this._enterEditMode(ev);
                    });
                    div.__tnBound = true;
                }
                // 编辑态退出绑定（textarea 可能被 Vue 重建，逐个绑定）
                if (!ta.__tnBlurBound && ta.addEventListener) {
                    ta.addEventListener("blur", () => { if (this._editMode) this._exitEditMode(); });
                    ta.__tnBlurBound = true;
                }
                return div;
            }

            /** 旧版把占位提示存成了正文 → 视为空便签清掉（按值判断，幂等，可反复调用） */
            _clearLegacyPlaceholder(widget) {
                const w = widget || (this.widgets || []).find((x) => x.name === "text");
                if (!w || typeof w.value !== "string" || !w.value) return false;
                if (!LEGACY_PLACEHOLDER_TEXTS.has(normalizeNoteText(w.value))) return false;
                w.value = "";   // 只清正文；提示仍由渲染层 / placeholder 显示
                return true;
            }

            /** 用正文当前值重渲染 HTML */
            _renderIntoDiv() {
                const div = this._renderDiv;
                if (!div) return;
                const w = (this.widgets || []).find((x) => x.name === "text");
                this._clearLegacyPlaceholder(w);
                const val = w ? String(w.value ?? "") : "";
                div.innerHTML = renderRichText(val);
                div.__lastText = val;
            }

            /** 逐帧同步渲染层位置（跟随前端对 textarea 的定位）；兼做自愈：
             *  div 未建/挂错父节点/内容过期都在这里修复 —— 不依赖设置开关触发 */
            _syncRenderDiv() {
                const ta = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                if (!ta) return;
                const div = this._ensureRenderDiv();   // 每帧确保存在 + 挂对父节点
                if (!div) return;
                div.style.position = "absolute";
                div.style.left = ta.style.left || "0px";
                div.style.top = ta.style.top || "0px";
                div.style.width = ta.style.width || (this.size[0] - 16) + "px";
                div.style.height = this._bodyHeightPx() + "px";   // 显式像素高度
                div.style.zIndex = ta.style.zIndex || "1";
                div.style.overflow = "hidden";
                // 正文被外部修改（工作流加载等）时重渲染；旧版占位提示先清空
                if (!this._editMode) {
                    const w = (this.widgets || []).find((x) => x.name === "text");
                    this._clearLegacyPlaceholder(w);
                    const val = w ? String(w.value ?? "") : "";
                    if (div.__lastText !== val) this._renderIntoDiv();
                }
            }

            /** 把鼠标坐标换算成正文里的字符下标并把光标放过去（命中 textarea 才返回 true）。
             *  浏览器自带的 caretPositionFromPoint 对 textarea 直接给出 value 里的字符下标，
             *  换行/居中/自动折行都由浏览器算，不需要自己排版。 */
            _caretFromPoint(x, y) {
                const ta = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                if (!ta || typeof document === "undefined" ||
                    typeof ta.setSelectionRange !== "function") return false;
                const end = String(ta.value ?? "").length;

                // 点在正文最后一行下方的空白处 → 光标放到末尾（最常见的「接着写」）
                const last = this._renderDiv && this._renderDiv.lastElementChild;
                if (last && last.getBoundingClientRect) {
                    const r = last.getBoundingClientRect();
                    if (r && r.height > 0 && y > r.bottom) {
                        try { ta.setSelectionRange(end, end); } catch { return false; }
                        return true;
                    }
                }

                let hit = false, idx = 0;
                try {
                    if (typeof document.caretPositionFromPoint === "function") {
                        const p = document.caretPositionFromPoint(x, y);
                        if (p && p.offsetNode === ta && typeof p.offset === "number") {
                            hit = true; idx = p.offset;
                        }
                    }
                    if (!hit && typeof document.caretRangeFromPoint === "function") {
                        // 旧接口：WebKit 系可能返回 textarea 内部文本节点
                        const r = document.caretRangeFromPoint(x, y);
                        const n = r && r.startContainer;
                        if (n === ta && typeof r.startOffset === "number") {
                            hit = true; idx = r.startOffset;
                        } else if (n && n.nodeType === 3) {
                            const host = n.parentElement && n.parentElement.closest
                                ? n.parentElement.closest("textarea") : null;
                            if (host === ta) { hit = true; idx = r.startOffset; }
                        }
                    }
                } catch { hit = false; }

                if (!hit) return false;                         // 点在控件外/浏览器不支持 → 交给调用方兜底
                const at = Math.max(0, Math.min(end, idx));     // 越界/异常下标夹进合法范围
                try { ta.setSelectionRange(at, at); } catch { return false; }
                return true;
            }

            /** 命中测试拿不到结果时的兜底：按行高估算点在第几行，把光标放到那一行行首
             *  （估不出来才退到末尾）—— 总比让用户从别处一路按方向键要好 */
            _fallbackCaret(x, y, ta) {
                const el = ta || (this.textWidget && (this.textWidget.inputEl || this.textWidget.element));
                if (!el || typeof el.setSelectionRange !== "function") return;
                const text = String(el.value ?? "");
                let at = text.length;
                try {
                    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
                    const lh = (parseFloat(typeof getComputedStyle === "function"
                        ? getComputedStyle(el).lineHeight : "") || 0) || 20;
                    if (rect && rect.height > 0 && typeof y === "number") {
                        const rows = text.split("\n");
                        if (y > rect.top + rows.length * lh) {
                            at = text.length;                        // 点在正文最后一行之下 → 末尾
                        } else {
                            const row = Math.max(0, Math.min(rows.length - 1,
                                Math.floor((y - rect.top) / lh)));
                            at = rows.slice(0, row).join("\n").length + (row > 0 ? 1 : 0);
                        }
                    }
                } catch { at = text.length; }
                try { el.setSelectionRange(at, at); } catch {}
            }

            /** 单击正文 → 编辑态，并把光标落在点击位置；同时收起面板/色卡 */
            _enterEditMode(ev) {
                if (this._editMode) return;
                if (this.settingsOpen) this._toggleSettings(false);
                if (this.openMenu) this._toggleColorMenu(false);
                this._editMode = true;
                this.applyNoteStyles();          // textarea 立刻可见（渲染层转透明且不再吃点击）
                const ta = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                if (ta && ta.focus) {
                    const pt = ev && typeof ev.clientX === "number"
                        ? { x: ev.clientX, y: ev.clientY } : null;
                    const place = () => {
                        try { ta.focus(); } catch {}
                        if (!pt) return true;
                        if (this._caretFromPoint(pt.x, pt.y)) return true;
                        this._fallbackCaret(pt.x, pt.y, ta);   // 先给个近似位置
                        return false;                          // 让调用方下一帧再精确试一次
                    };
                    setTimeout(() => {
                        if (place() === false && typeof requestAnimationFrame === "function") {
                            requestAnimationFrame(() => {
                                try { ta.focus(); } catch {}
                                this._caretFromPoint(pt.x, pt.y);
                            });
                        }
                    }, 0);
                }
                this.setDirtyCanvas(true, true);
            }

            /** 失焦 → 回到渲染态 */
            _exitEditMode() {
                if (!this._editMode) return;
                this._editMode = false;
                this._renderIntoDiv();
                this.applyNoteStyles();
                this.setDirtyCanvas(true, true);
            }

            onRemoved() {
                if (this._renderDiv) { try { this._renderDiv.remove(); } catch {} this._renderDiv = null; }
            }

            // ---------- 齿轮与设置面板 ----------

            /** 齿轮按钮矩形（标题栏右侧） */
            gearRect() {
                return [this.size[0] - GEAR_W - 8, -26, GEAR_W, 22];
            }

            /** 展开：正文预览区保留上方，面板追加在正文下方 → 同时可见，边调边看 */
            _toggleSettings(open) {
                if (open) {
                    this._prevSize = [this.size[0], this.size[1]];
                    this._previewH = Math.max(120, Math.round(this.size[1]));
                    this.size[1] = this._previewH + PANEL_GAP + this._panelHeight() + 8;
                    if (this.textWidget)
                        this.textWidget.computeSize = () => [this.size[0], this._previewH];
                    this.settingsOpen = true;
                } else {
                    this.settingsOpen = false;
                    if (this.textWidget) delete this.textWidget.computeSize;
                    this._previewH = null;
                    if (this._prevSize) {
                        this.size[1] = this._prevSize[1];
                        this._prevSize = null;
                    }
                }
                this.applyNoteStyles();
                this.setDirtyCanvas(true, true);
            }

            _panelHeight() {
                return PANEL_HEADER_H + PANEL_ROWS.length * PANEL_ROW_H + PANEL_PAD * 2;
            }

            /** 设置面板矩形（正文预览区下方，不与正文重叠） */
            panelRect() {
                const top = (this._previewH ?? this.size[1]) + PANEL_GAP;
                return [6, top, this.size[0] - 12, this._panelHeight()];
            }

            _pointInRect(p, r) {
                return p[0] >= r[0] && p[0] <= r[0] + r[2] &&
                       p[1] >= r[1] && p[1] <= r[1] + r[3];
            }

            /** 颜色行的命中矩形 */
            _colorRowRect(rowKey) {
                const pr = this.panelRect();
                const idx = PANEL_ROWS.indexOf(rowKey);
                const y = pr[1] + PANEL_HEADER_H + PANEL_PAD + idx * PANEL_ROW_H;
                return [pr[0], y, pr[2], PANEL_ROW_H];
            }

            /** 指定颜色行的下拉色卡矩形（锚定在面板下方，不遮挡任何面板行） */
            menuRect(rowKey) {
                const key = rowKey || this.openMenu || "font_color";
                const palette = paletteFor(key);
                const w = MENU_COLS * MENU_CELL_W + MENU_PAD * 2;
                const h = MENU_HEADER + Math.ceil(palette.length / MENU_COLS) * MENU_CELL_H + MENU_PAD * 2;
                const pr = this.panelRect();
                const x = Math.max(6, pr[0] + pr[2] - w);
                return [x, pr[1] + pr[3] + 6, w, h];
            }

            /** 色块单元格列表（色块与名称左右排列） */
            _menuCells() {
                const key = this.openMenu || "font_color";
                const palette = paletteFor(key);
                const mr = this.menuRect(key);
                const cells = [];
                palette.forEach((c, i) => {
                    const col = i % MENU_COLS, row = Math.floor(i / MENU_COLS);
                    const x = mr[0] + MENU_PAD + col * MENU_CELL_W;
                    const y = mr[1] + MENU_HEADER + MENU_PAD + row * MENU_CELL_H;
                    cells.push({ c, x, y, w: MENU_CELL_W, h: MENU_CELL_H });
                });
                return cells;
            }

            /** 打开/关闭颜色下拉色卡；打开时节点加高容纳 */
            _toggleColorMenu(open, rowKey) {
                if (open) {
                    if (!this.settingsOpen) this._toggleSettings(true);
                    this.openMenu = rowKey || "font_color";
                    const mr = this.menuRect(this.openMenu);
                    const need = mr[1] + mr[3] + 8;
                    if (this.size[1] < need) this.size[1] = need;
                } else {
                    this.openMenu = null;
                    if (this.settingsOpen) {
                        const pr = this.panelRect();
                        const base = pr[1] + pr[3] + 8;
                        if (this.size[1] > base) this.size[1] = base;
                    }
                }
                this.setDirtyCanvas(true, true);
            }

            /** 菜单点击：选中 hex 写入对应控件并实时生效 */
            _handleMenuClick(pos) {
                const key = this.openMenu || "font_color";
                for (const cell of this._menuCells()) {
                    if (pos[0] >= cell.x && pos[0] <= cell.x + cell.w &&
                        pos[1] >= cell.y && pos[1] <= cell.y + cell.h) {
                        const w = (this.widgets || []).find((x) => x.name === key);
                        if (w) w.value = cell.c.hex;
                        this.applyNoteStyles();
                        this._toggleColorMenu(false);
                        return true;
                    }
                }
                this._toggleColorMenu(false);   // 点空白处关闭
                return true;
            }

            /** 数值行：弹出数字输入框，回车确认 */
            _openNumberInput(rowKey, domEvent) {
                if (typeof document === "undefined") return;
                const cfg = NUM_ROWS[rowKey];
                const w = (this.widgets || []).find((x) => x.name === rowKey);
                if (!cfg || !w) return;
                const input = document.createElement("input");
                input.type = "number";
                input.min = String(cfg.min);
                input.max = String(cfg.max);
                input.step = cfg.int ? "1" : "0.1";
                input.value = String(Number(w.value) || cfg.min);
                Object.assign(input.style, {
                    position: "fixed",
                    left: ((domEvent && domEvent.clientX) || 100) + "px",
                    top: ((domEvent && domEvent.clientY) || 100) + "px",
                    width: "64px", padding: "4px 6px", fontSize: "14px",
                    background: "#111111", color: "#FFFFFF",
                    border: "1px solid rgba(255,255,255,0.35)", borderRadius: "4px",
                    zIndex: "99999",
                });
                let done = false;
                const commit = () => {
                    if (done) return;
                    done = true;
                    const n = Number(input.value);
                    if (!Number.isNaN(n) && n >= cfg.min && n <= cfg.max) {
                        w.value = cfg.int ? String(Math.round(n))
                                          : String(Math.round(n * 100) / 100);
                        this.applyNoteStyles();
                        this.setDirtyCanvas(true, true);
                    }
                    input.remove();
                };
                input.addEventListener("keydown", (ev) => {
                    ev.stopPropagation();
                    if (ev.key === "Enter") commit();
                    else if (ev.key === "Escape") { done = true; input.remove(); }
                });
                input.addEventListener("blur", commit);
                document.body.appendChild(input);
                setTimeout(() => input.focus(), 0);
            }

            /** 兼容旧调用 */
            _openFontSizeInput(domEvent) {
                return this._openNumberInput("font_size", domEvent);
            }

            /** 数值行点击：命中区与绘制的 − / 数字 / ＋ 符号逐像素对齐 */
            _handleNumericRowClick(key, pos, event, pr) {
                const cfg = NUM_ROWS[key];
                const w = (this.widgets || []).find((x) => x.name === key);
                if (!cfg || !w) return true;
                const right = pr[0] + pr[2] - PANEL_PAD - 4;   // 与绘制侧一致
                const x = pos[0];
                const inMinus = x >= right - 104 && x <= right - 72;
                const inValue = x > right - 72 && x < right - 32;
                const inPlus = x >= right - 32;
                const cur = Number(w.value) || cfg.min;
                const fmt = (n) => cfg.int ? String(Math.round(n))
                                           : String(Math.round(n * 100) / 100);
                if (event && event.button === 2) {
                    w.value = fmt(Math.max(cfg.min, cur - cfg.step));
                } else if (inMinus) {
                    w.value = fmt(Math.max(cfg.min, cur - cfg.step));
                } else if (inPlus) {
                    w.value = fmt(Math.min(cfg.max, cur + cfg.step));
                } else if (inValue) {
                    this._openNumberInput(key, event);
                    return true;
                } else {
                    return true;   // 行标签区：吞掉不动作
                }
                this.applyNoteStyles();
                this.setDirtyCanvas(true, true);
                return true;
            }

            /** 面板行点击：数值行=三区加减/输入，颜色行=下拉色卡，其他 combo 循环取值 */
            _handlePanelClick(pos, event) {
                const pr = this.panelRect();
                const idx = Math.floor((pos[1] - (pr[1] + PANEL_HEADER_H + PANEL_PAD)) / PANEL_ROW_H);
                if (idx < 0 || idx >= PANEL_ROWS.length) return true;   // 面板空白处，吞掉
                const key = PANEL_ROWS[idx];
                const w = (this.widgets || []).find((x) => x.name === key);
                if (!w) return true;

                if (NUM_ROWS[key]) {
                    return this._handleNumericRowClick(key, pos, event, pr);
                }

                if (w.type === "toggle") {
                    w.value = !w.value;
                } else {
                    const vals = w.options?.values || [];
                    const i = vals.indexOf(String(w.value));
                    const backward = event && event.button === 2;
                    const next = backward
                        ? (i <= 0 ? vals.length - 1 : i - 1)
                        : (i < 0 || i >= vals.length - 1 ? 0 : i + 1);
                    w.value = vals[next];
                }
                this.applyNoteStyles();
                this.setDirtyCanvas(true, true);
                return true;
            }

            /** 节点级点击处理（本版 litegraph 的节点钩子是 onMouseDown） */
            onMouseDown(event, pos, graphcanvas) {
                if (this.flags && this.flags.collapsed) return false;
                const isDown = !event || !event.type || !/up$|move/.test(event.type);
                const isLeft = !event || event.button === undefined || event.button === 0;
                if (this._pointInRect(pos, this.gearRect())) {
                    if (isDown && isLeft) {
                        this._toggleSettings(!this.settingsOpen);
                    }
                    return true;
                }
                // 颜色菜单打开时优先处理
                if (this.openMenu) {
                    const mr = this.menuRect(this.openMenu);
                    if (this._pointInRect(pos, mr)) {
                        if (isDown && isLeft) this._handleMenuClick(pos);
                        return true;
                    }
                    const onColorRow = MENU_ROWS.some((rk) => this._pointInRect(pos, this._colorRowRect(rk)));
                    if (!onColorRow) this._toggleColorMenu(false);
                }
                if (this.settingsOpen) {
                    const pr = this.panelRect();
                    if (this._pointInRect(pos, pr)) {
                        if (isDown && isLeft) {
                            for (const rowKey of MENU_ROWS) {
                                if (this._pointInRect(pos, this._colorRowRect(rowKey))) {
                                    const wasOpen = this.openMenu === rowKey;
                                    this._toggleColorMenu(!wasOpen, rowKey);   // 再点同一行 = 收起
                                    return true;
                                }
                            }
                        }
                        if (isDown) {
                            if (pos[0] > pr[0] + pr[2] - 24 && pos[1] < pr[1] + PANEL_HEADER_H) {
                                this._toggleSettings(false);
                                return true;
                            }
                            return this._handlePanelClick(pos, event);
                        }
                        return true;   // 面板内悬停/滚轮吞掉
                    }
                }
                return false;
            }

            /** 标题栏：右侧齿轮（打开时高亮）；折叠态不画 */
            onDrawTitle(ctx) {
                if (this.flags && this.flags.collapsed) return;
                const r = this.gearRect();
                ctx.save();
                if (this.settingsOpen) {
                    ctx.fillStyle = "rgba(255,255,255,0.14)";
                    ctx.beginPath();
                    ctx.roundRect ? ctx.roundRect(r[0], r[1], r[2], r[3], 4)
                                  : ctx.rect(r[0], r[1], r[2], r[3]);
                    ctx.fill();
                }
                ctx.fillStyle = this.settingsOpen ? "#FFFFFF" : "rgba(236,239,241,0.75)";
                ctx.font = "14px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(GEAR, r[0] + r[2] / 2, r[1] + r[3] / 2 + 1);
                ctx.restore();
                ctx.textAlign = "left";   // 不污染后续标题绘制
            }

            /** 主体绘制：设置面板（展开时），纯 canvas；并同步渲染层位置 */
            onDrawBackground(ctx) {
                // 渲染层逐帧跟随 textarea 位置（前端每帧可能重排）
                this._syncRenderDiv();
                // Vue 重建 DOM 后样式丢失的自检重放
                const ta0 = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                if (ta0 && ta0.dataset && ta0.dataset.tnStyled !== "1") this.applyNoteStyles();
                if (!this.settingsOpen || (this.flags && this.flags.collapsed)) return;
                const pr = this.panelRect();
                ctx.save();

                ctx.fillStyle = "rgba(10,10,10,0.96)";
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(pr[0], pr[1], pr[2], pr[3], 6)
                              : ctx.rect(pr[0], pr[1], pr[2], pr[3]);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.16)";
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.fillStyle = "rgba(236,239,241,0.85)";
                ctx.font = "12px sans-serif";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(t("settings"), pr[0] + PANEL_PAD + 4, pr[1] + PANEL_HEADER_H / 2);
                ctx.fillText(CLOSE, pr[0] + pr[2] - 14, pr[1] + PANEL_HEADER_H / 2);
                ctx.strokeStyle = "rgba(255,255,255,0.10)";
                ctx.beginPath();
                ctx.moveTo(pr[0] + 4, pr[1] + PANEL_HEADER_H);
                ctx.lineTo(pr[0] + pr[2] - 4, pr[1] + PANEL_HEADER_H);
                ctx.stroke();

                const byName = {};
                for (const w of this.widgets || []) byName[w.name] = w;
                PANEL_ROWS.forEach((key, i) => {
                    const y = pr[1] + PANEL_HEADER_H + PANEL_PAD + i * PANEL_ROW_H;
                    const w = byName[key];
                    const midY = y + PANEL_ROW_H / 2;
                    ctx.fillStyle = "rgba(176,190,197,0.85)";
                    ctx.textAlign = "left";
                    ctx.fillText(t(key), pr[0] + PANEL_PAD + 4, midY);

                    const right = pr[0] + pr[2] - PANEL_PAD - 4;
                    if (NUM_ROWS[key]) {
                        const valueText = w ? String(w.value) : "";
                        ctx.textAlign = "left";
                        ctx.fillStyle = "rgba(236,239,241,0.75)";
                        ctx.fillText("−", right - 96, midY);
                        ctx.textAlign = "center";
                        ctx.fillStyle = "#ECEFF1";
                        ctx.fillText(valueText, right - 52, midY);
                        ctx.textAlign = "left";
                        ctx.fillStyle = "rgba(236,239,241,0.75)";
                        ctx.fillText("＋", right - 14, midY);
                    } else if (MENU_ROWS.includes(key)) {
                        const hex = w ? String(w.value) : "";
                        const nameText = colorName(hex, paletteFor(key));
                        ctx.textAlign = "left";
                        ctx.fillStyle = "#ECEFF1";
                        ctx.fillText(nameText, right - 62, midY);
                        if (hex === "transparent") {
                            ctx.strokeStyle = "rgba(128,128,128,0.8)";
                            ctx.lineWidth = 1;
                            ctx.strokeRect(right - 18.5, midY - 6.5, 19, 13);
                            ctx.beginPath();
                            ctx.moveTo(right - 18.5, midY + 6.5);
                            ctx.lineTo(right + 0.5, midY - 6.5);
                            ctx.stroke();
                        } else {
                            ctx.fillStyle = hex;
                            ctx.fillRect(right - 18, midY - 6, 18, 12);
                            if (hex === "#FFFFFF" || hex === "#000000") {
                                ctx.strokeStyle = "rgba(128,128,128,0.8)";
                                ctx.lineWidth = 1;
                                ctx.strokeRect(right - 18.5, midY - 6.5, 19, 13);
                            }
                        }
                    } else {
                        let valueText = "";
                        if (w) {
                            if (w.type === "toggle") valueText = w.value ? t("on") : t("off");
                            else if (key === "align") valueText = t(String(w.value)) || String(w.value);
                            else valueText = String(w.value);
                        }
                        ctx.textAlign = "right";
                        ctx.fillStyle = "#ECEFF1";
                        ctx.fillText("‹ " + valueText + " ›", right, midY);
                    }
                    if (i < PANEL_ROWS.length - 1) {
                        ctx.strokeStyle = "rgba(255,255,255,0.06)";
                        ctx.beginPath();
                        ctx.moveTo(pr[0] + 4, y + PANEL_ROW_H);
                        ctx.lineTo(pr[0] + pr[2] - 4, y + PANEL_ROW_H);
                        ctx.stroke();
                    }
                });
                ctx.restore();

                if (this.openMenu) this._drawColorMenu(ctx, this.openMenu);
            }

            /** 颜色下拉色卡绘制（色块与名称左右排列） */
            _drawColorMenu(ctx, rowKey) {
                const key = rowKey || this.openMenu || "font_color";
                const palette = paletteFor(key);
                const mr = this.menuRect(key);
                ctx.save();
                ctx.fillStyle = "rgba(12,12,12,0.97)";
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(mr[0], mr[1], mr[2], mr[3], 6)
                              : ctx.rect(mr[0], mr[1], mr[2], mr[3]);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.2)";
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.fillStyle = "rgba(176,190,197,0.9)";
                ctx.font = "10px sans-serif";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText(t(key), mr[0] + MENU_PAD + 2, mr[1] + MENU_HEADER / 2);
                const selected = (this.widgets || []).find((w) => w.name === key)?.value;
                for (const cell of this._menuCells()) {
                    if (cell.c.hex === "transparent") {
                        ctx.strokeStyle = "rgba(128,128,128,0.8)";
                        ctx.lineWidth = 1;
                        ctx.strokeRect(cell.x + 4.5, cell.y + (cell.h - 12) / 2 - 0.5, 17, 13);
                        ctx.beginPath();
                        ctx.moveTo(cell.x + 4.5, cell.y + (cell.h - 12) / 2 + 12.5);
                        ctx.lineTo(cell.x + 21.5, cell.y + (cell.h - 12) / 2 - 0.5);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = cell.c.hex;
                        ctx.fillRect(cell.x + 4, cell.y + (cell.h - 12) / 2, 16, 12);
                        if (cell.c.hex === "#FFFFFF" || cell.c.hex === "#000000") {
                            ctx.strokeStyle = "rgba(128,128,128,0.8)";
                            ctx.lineWidth = 1;
                            ctx.strokeRect(cell.x + 4.5, cell.y + (cell.h - 12) / 2 - 0.5, 17, 13);
                        }
                    }
                    if (cell.c.hex === selected) {
                        ctx.strokeStyle = MENU_SELECTED;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(cell.x + 1.5, cell.y + 1.5, cell.w - 3, cell.h - 3);
                    }
                    ctx.fillStyle = "rgba(236,239,241,0.85)";
                    ctx.font = "11px sans-serif";
                    ctx.textAlign = "left";
                    ctx.fillText(cell.c[LANG()] || cell.c.en, cell.x + 26, cell.y + cell.h / 2);
                }
                ctx.restore();
            }

            /** 应用设置到正文 textarea 与节点外框 */
            applyNoteStyles() {
                const byName = {};
                for (const x of this.widgets || []) byName[x.name] = x;
                const v = (name, dft) => (byName[name] !== undefined && byName[name] !== null ? byName[name].value : dft);

                const fontColor = v("font_color", "#FFFFFF");
                const bgColor = v("bg_color", "#2E4A7A");
                let borderColor = v("border_color", "#4B4A47");
                const align = v("align", "center");
                const fs = Number(v("font_size", "16")) || 16;
                const lh = Number(v("line_spacing", "1.4")) || 1.4;
                const bold = !!v("bold", false);

                this.bgcolor = bgColor;
                this.color = borderColor === "transparent" ? bgColor : borderColor;

                const ta = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                const bodyPx = this._bodyHeightPx();
                if (ta) {
                    const s = ta.style;
                    if (ta.dataset) ta.dataset.tnStyled = "1";
                    s.fontSize = fs + "px";
                    s.lineHeight = String(lh);
                    s.textAlign = align;
                    s.fontWeight = bold ? "600" : "400";
                    s.color = fontColor;
                    s.fontFamily = '"Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif';
                    s.background = "transparent";
                    s.border = "none";
                    s.outline = "none";
                    s.boxShadow = "none";
                    s.padding = "0";
                    s.boxSizing = "border-box";
                    s.width = "100%";
                    s.height = bodyPx + "px";   // 显式像素高度，编辑态立即可见可输入
                    s.resize = "none";
                    // 编辑态才显示 textarea；渲染态隐藏（由渲染层 div 接管）
                    s.display = this._editMode ? "" : "none";
                    s.zIndex = "2";
                    // 空便签时用 placeholder 继续显示提示（真正的 value 为空，直接就能输入）
                    if ("placeholder" in ta) ta.placeholder = t("defaultText");
                    if (ta.classList && ta.classList.add) ta.classList.add("tn-textnote-input");
                    ensurePlaceholderStyle();
                }
                // 渲染层跟随同样式
                const div = this._ensureRenderDiv();
                if (div) {
                    const ds = div.style;
                    ds.fontSize = fs + "px";
                    ds.lineHeight = String(lh);
                    ds.textAlign = align;
                    ds.fontWeight = bold ? "600" : "400";
                    ds.color = fontColor;
                    ds.fontFamily = '"Segoe UI", "Microsoft YaHei", "PingFang SC", sans-serif';
                    ds.background = "transparent";
                    ds.padding = "0";
                    ds.boxSizing = "border-box";
                    ds.width = "100%";
                    ds.height = bodyPx + "px";
                    ds.userSelect = "none";
                    // 设置面板展开时正文预览区照样显示（面板画在预览区下方，不重叠），
                    // 这样边调样式边看效果；编辑态只用 opacity 让位给 textarea
                    ds.display = "";
                    ds.opacity = this._editMode ? "0" : "1";
                    // 编辑态必须连点击一起让开：div 还压在上面的话，既吞掉点击，
                    // 也会让 caretPositionFromPoint 命中 div 而不是 textarea ——
                    // 表现就是「点了没反应，只能用方向键一点点挪光标」
                    ds.pointerEvents = this._editMode ? "none" : "auto";
                }
                if (this.setDirtyCanvas) this.setDirtyCanvas(true, false);
            }

            /** 工作流加载/粘贴：迁移旧中文存储 → 重放样式 → 复位面板与编辑态 */
            onConfigure(info) {
                try {
                    const pairs = (info && info.widgets) || [];
                    const get = (name) => {
                        for (const p of pairs) {
                            const n = Array.isArray(p) ? p[0] : p && p.name;
                            const v = Array.isArray(p) ? p[1] : p && p.value;
                            if (n === name) return v;
                        }
                        return undefined;
                    };
                    const setIf = (k, v) => {
                        const w = (this.widgets || []).find((x) => x.name === k);
                        if (w && v !== undefined && v !== null) w.value = v;
                    };
                    // 新版键直接还原
                    for (const k of ["font_size", "align", "line_spacing", "font_color", "bg_color", "border_color", "bold"]) {
                        setIf(k, get(k));
                    }
                    // 旧版中文键迁移
                    for (const [oldName, newKey] of Object.entries(LEGACY_WIDGET_KEYS)) {
                        const v = get(oldName);
                        if (v === undefined) continue;
                        if (newKey === "align") setIf(newKey, LEGACY_ALIGN[v] ?? v);
                        else if (newKey === "bold") setIf(newKey, v);
                        else if (newKey === "font_size" || newKey === "line_spacing") setIf(newKey, String(v));
                        else {
                            const table = newKey === "font_color" ? LEGACY_FONT_COLORS
                                : newKey === "bg_color" ? LEGACY_BG_COLORS : LEGACY_BORDER_COLORS;
                            setIf(newKey, table[v] ?? v);
                        }
                    }
                } catch (e) {
                    console.warn("[TextNote] legacy migration failed:", e);
                }
                this.settingsOpen = false;
                this.openMenu = null;
                this._previewH = null;
                this._editMode = false;
                if (this.textWidget) delete this.textWidget.computeSize;
                setTimeout(() => {
                    this._clearLegacyPlaceholder();   // 旧版占位提示 → 清空，恢复为空便签
                    this._ensureRenderDiv();
                    this._renderIntoDiv();
                    this.applyNoteStyles();
                }, 0);
            }
        }

        LG.registerNodeType("TextNote", Object.assign(TextNoteNode, {
            title: t("title"),
            collapsable: true,
        }));
        TextNoteNode.category = "utilities";   // 与官方 Note 同分类

        console.info("[TextNote] v4.3 sticky-note registered (click-to-edit at caret, placeholder hint, gear settings, zh/en UI)");
    },
});
