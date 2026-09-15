/**
 * ComfyUI-TextNote v3 — 画布便签（纯正文 + 右上角齿轮设置）
 *
 * 画布上只显示便签正文文字；所有参数（字号/对齐/行距/文字颜色/背景颜色/
 * 边框颜色/加粗）收进右上角齿轮图标弹出的设置面板。
 * 无输入口/输出口，不参与执行；内容与设置随工作流 JSON 保存。
 */
import { app } from "/scripts/app.js";

// ---------------- 色板 ----------------
// 文字颜色：高饱和度 + 白 + 黑（面板内点击弹出下拉菜单选择）
const FONT_COLORS = [
    ["大红", "#F44336"], ["朱橙", "#FF6D00"], ["橙", "#FFAB00"], ["柠檬黄", "#FFEA00"], ["草绿", "#AEEA00"],
    ["翠绿", "#00E676"], ["青绿", "#1DE9B6"], ["天蓝", "#40C4FF"], ["宝蓝", "#536DFE"], ["紫罗兰", "#B388FF"],
    ["品红", "#FF4081"], ["玫红", "#F50057"], ["白", "#FFFFFF"], ["黑", "#000000"],
];
// 背景颜色：中等饱和度的深色系（明度约 20–40%，饱和度约 30–60%）
const BG_COLORS = [
    ["藏青", "#24344D"], ["墨蓝", "#2E4A7A"], ["靖蓝", "#33518F"], ["孔雀蓝", "#1F6E72"],
    ["青碧", "#2E6B5E"], ["松柏绿", "#2F5D3A"], ["苔绿", "#5A6B3A"], ["姜饼", "#8A6E3A"],
    ["赭石", "#8A5A2E"], ["焦茶", "#5C4632"], ["酒红", "#6B2D3E"], ["玫褐", "#8A4A5E"],
    ["绛紫", "#5C3A6E"], ["茄紫", "#47355C"], ["珊瑚暗", "#8A4A4A"], ["墨青", "#2E5555"],
];
// 边框颜色：无/隐形 + 中性色调 + 莫兰迪色系
const BORDER_COLORS = [
    ["无/隐形", "transparent"], ["纯白", "#FFFFFF"], ["浅灰", "#D5D5D2"], ["中灰", "#A9A69E"],
    ["深灰", "#4B4A47"], ["炭黑", "#262626"], ["灰驼", "#B3A99A"], ["雾粉", "#C9AFAA"],
    ["豆沙", "#AD928D"], ["雾蓝", "#9AAABB"], ["雾霾蓝", "#72879A"], ["灰绿", "#93A38F"],
    ["橄榄绿", "#7F8770"], ["雾紫", "#A395A3"], ["姜黄", "#B9A076"], ["旧粉白", "#E8E2D6"],
];
const ALIGN_OPTIONS = [["左对齐", "left"], ["居中", "center"], ["右对齐", "right"]];

const labelValue = (pairs, label, fallback) =>
    (pairs.find((p) => p[0] === label) || [null, fallback])[1];

const GEAR = "\u2699";       // ⚙
const CLOSE = "\u2715";      // ✕

// 设置面板布局常量
const PANEL_ROW_H = 24;
const PANEL_HEADER_H = 26;
const PANEL_PAD = 8;
const PANEL_GAP = 10;      // 面板与正文预览区的间距
const GEAR_W = 22;

// 文字颜色下拉菜单
const MENU_COLS = 4;
const MENU_CELL_W = 64;
const MENU_CELL_H = 22;
const MENU_HEADER = 18;
const MENU_PAD = 5;
const MENU_SELECTED = "#E8C84A";
// 使用下拉色卡选择的行（交互与文字颜色一致）
const MENU_ROWS = ["文字颜色", "背景颜色", "边框颜色"];

// 字号调节
const FS_MIN = 8;
const FS_MAX = 128;
const FS_STEP = 2;

// 数值行（− / 数字 / ＋ 三区点击）配置：字号与行距共用同一套交互
const NUM_ROWS = {
    "字号": { min: 8, max: 128, step: 2, int: true },
    "行距": { min: 0.8, max: 3, step: 0.1, int: false },
};

// 面板行定义：与控件名一一对应
const PANEL_ROWS = ["字号", "对齐", "行距", "文字颜色", "背景颜色", "边框颜色", "加粗"];

app.registerExtension({
    name: "TextNote.CanvasNote",
    registerCustomNodes() {
        const LG = window.LiteGraph;
        if (!LG || !window.LGraphNode) {
            console.error("[TextNote] LiteGraph 全局对象不可用，便签节点未注册");
            return;
        }

        class TextNoteNode extends window.LGraphNode {
            constructor() {
                super();
                if (!this.properties) this.properties = {};
                this.serialize_widgets = true;   // 正文 + 设置随工作流保存
                this.isVirtualNode = true;       // 纯注解：不参与执行
                this.color = "#4B4A47";          // 边框/标题色（默认深灰）
                this.bgcolor = "#2E4A7A";        // 便签底色（默认墨蓝，中等饱和深色）
                this.size = [320, 180];
                this.settingsOpen = false;       // 运行时态，不序列化
                this.openMenu = null;            // 当前打开的下拉色卡所属行名，运行时态

                const onChange = () => this.applyNoteStyles();
                const hide = (w) => {
                    // 同时兼容新前端布局过滤与旧画布绘制两条路径
                    w.hidden = true;
                    if (!w.options) w.options = {};
                    w.options.hidden = true;
                    return w;
                };
                const add = (type, name, value, options) =>
                    hide(this.addWidget(type, name, value, onChange, options || {}));

                // 正文：官方同款多行编辑区（唯一可见元素，即便签本体）
                const CW = window.comfyAPI?.widgets?.ComfyWidgets;
                if (CW) {
                    this.textWidget = CW.STRING(
                        this, "text",
                        ["STRING", { default: "在这里写说明、备注…", multiline: true }],
                        app,
                    ).widget;
                } else {
                    this.textWidget = this.addWidget("text", "text", "在这里写说明、备注…", onChange);
                }

                // 设置控件：创建即隐藏，只从齿轮面板操作
                add("combo", "字号", "16", { values: ["12", "14", "16", "18", "22", "26", "32", "40", "52"] });
                add("combo", "对齐", "居中", { values: ALIGN_OPTIONS.map((a) => a[0]) });
                add("combo", "行距", "1.4", { values: ["1.0", "1.2", "1.4", "1.6", "1.8", "2.0"] });
                add("combo", "文字颜色", "白", { values: FONT_COLORS.map((c) => c[0]) });
                add("combo", "背景颜色", "墨蓝", { values: BG_COLORS.map((c) => c[0]) });
                add("combo", "边框颜色", "深灰", { values: BORDER_COLORS.map((c) => c[0]) });
                add("toggle", "加粗", false);

                this.applyNoteStyles();
            }

            // ---------- 齿轮与设置面板 ----------

            /** 齿轮按钮矩形（标题栏右侧；标题栏在节点本体上方 y∈[-30,0]） */
            gearRect() {
                return [this.size[0] - GEAR_W - 8, -26, GEAR_W, 22];
            }

            /** 展开设置面板：正文预览区保留在上方（高度不变），
             *  面板追加在正文下方 → 节点加高，两者同时可见，边调边看 */
            _toggleSettings(open) {
                if (open) {
                    this._prevSize = [this.size[0], this.size[1]];
                    this._previewH = Math.max(120, Math.round(this.size[1]));
                    this.size[1] = this._previewH + PANEL_GAP + this._panelHeight() + 8;
                    // 锁定正文编辑区高度 = 预览区高度，余下空间留给面板
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

            /** 设置面板总高 */
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

            /** 颜色行（文字/背景/边框）的命中矩形 */
            _colorRowRect(rowName) {
                const pr = this.panelRect();
                const idx = PANEL_ROWS.indexOf(rowName);
                const y = pr[1] + PANEL_HEADER_H + PANEL_PAD + idx * PANEL_ROW_H;
                return [pr[0], y, pr[2], PANEL_ROW_H];
            }

            /** 兼容旧名：文字颜色行矩形 */
            _fontColorRowRect() {
                return this._colorRowRect("文字颜色");
            }

            /** 指定颜色行的下拉色卡矩形（锚定在面板下方，不遮挡任何面板行） */
            menuRect(rowName) {
                const name = rowName || this.openMenu || "文字颜色";
                const palette = name === "背景颜色" ? BG_COLORS
                    : name === "边框颜色" ? BORDER_COLORS : FONT_COLORS;
                const w = MENU_COLS * MENU_CELL_W + MENU_PAD * 2;
                const h = MENU_HEADER + Math.ceil(palette.length / MENU_COLS) * MENU_CELL_H + MENU_PAD * 2;
                const pr = this.panelRect();
                const x = Math.max(6, pr[0] + pr[2] - w);
                return [x, pr[1] + pr[3] + 6, w, h];
            }

            /** 色块单元格列表（色块与名称左右排列） */
            _menuCells() {
                const name = this.openMenu || "文字颜色";
                const palette = name === "背景颜色" ? BG_COLORS
                    : name === "边框颜色" ? BORDER_COLORS : FONT_COLORS;
                const mr = this.menuRect(name);
                const cells = [];
                palette.forEach((c, i) => {
                    const col = i % MENU_COLS, row = Math.floor(i / MENU_COLS);
                    const x = mr[0] + MENU_PAD + col * MENU_CELL_W;
                    const y = mr[1] + MENU_HEADER + MENU_PAD + row * MENU_CELL_H;
                    cells.push({ c, x, y, w: MENU_CELL_W, h: MENU_CELL_H });
                });
                return cells;
            }

            /** 打开/关闭颜色下拉色卡（rowName = 文字颜色/背景颜色/边框颜色）；
             *  色卡锚定在面板下方，节点加高容纳，不遮挡面板行与正文 */
            _toggleColorMenu(open, rowName) {
                if (open) {
                    if (!this.settingsOpen) this._toggleSettings(true);
                    this.openMenu = rowName || "文字颜色";
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

            /** 菜单点击：选中颜色写入对应控件并实时生效 */
            _handleMenuClick(pos) {
                const name = this.openMenu || "文字颜色";
                for (const cell of this._menuCells()) {
                    if (pos[0] >= cell.x && pos[0] <= cell.x + cell.w &&
                        pos[1] >= cell.y && pos[1] <= cell.y + cell.h) {
                        const w = (this.widgets || []).find((x) => x.name === name);
                        if (w) w.value = cell.c[0];
                        this.applyNoteStyles();
                        this._toggleColorMenu(false);
                        return true;
                    }
                }
                this._toggleColorMenu(false);   // 点空白处关闭
                return true;
            }

            /** 数值行通用：弹出数字输入框，回车确认（按行配置的 min/max） */
            _openNumberInput(rowName, domEvent) {
                if (typeof document === "undefined") return;
                const cfg = NUM_ROWS[rowName];
                const w = (this.widgets || []).find((x) => x.name === rowName);
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

            /** 兼容旧调用：字号输入框 */
            _openFontSizeInput(domEvent) {
                return this._openNumberInput("字号", domEvent);
            }

            /** 数值行（字号/行距）点击：命中区与绘制的 − / 数字 / ＋ 符号逐像素对齐 */
            _handleNumericRowClick(name, pos, event, pr) {
                const cfg = NUM_ROWS[name];
                const w = (this.widgets || []).find((x) => x.name === name);
                if (!cfg || !w) return true;
                const right = pr[0] + pr[2] - PANEL_PAD - 4;   // 与绘制侧一致
                const x = pos[0];
                const inMinus = x >= right - 104 && x <= right - 72;
                const inValue = x > right - 72 && x < right - 32;
                const inPlus = x >= right - 32;
                const cur = Number(w.value) || cfg.min;
                const fmt = (n) => cfg.int ? String(Math.round(n))
                                           : String(Math.round(n * 100) / 100);
                // 右键任意位置 = 递减；左键按三区处理
                if (event && event.button === 2) {
                    w.value = fmt(Math.max(cfg.min, cur - cfg.step));
                } else if (inMinus) {
                    w.value = fmt(Math.max(cfg.min, cur - cfg.step));
                } else if (inPlus) {
                    w.value = fmt(Math.min(cfg.max, cur + cfg.step));
                } else if (inValue) {
                    this._openNumberInput(name, event);
                    return true;
                } else {
                    return true;   // 行标签区：吞掉不动作
                }
                this.applyNoteStyles();
                this.setDirtyCanvas(true, true);
                return true;
            }

            /** 面板行点击：字号/行距=三区加减/输入，颜色行=下拉色卡，其他 combo 循环取值 */
            _handlePanelClick(pos, event) {
                const pr = this.panelRect();
                const idx = Math.floor((pos[1] - (pr[1] + PANEL_HEADER_H + PANEL_PAD)) / PANEL_ROW_H);
                if (idx < 0 || idx >= PANEL_ROWS.length) return true;   // 点在面板空白处，吞掉
                const name = PANEL_ROWS[idx];
                const w = (this.widgets || []).find((x) => x.name === name);
                if (!w) return true;

                // 数值行（字号/行距）：命中区与符号位置逐像素对齐
                if (NUM_ROWS[name]) {
                    return this._handleNumericRowClick(name, pos, event, pr);
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

            /** 节点级点击处理。
             *  本版 litegraph 的节点钩子名是 onMouseDown（旧版同样）；
             *  标题栏与正文区域的点击都会进到这里。返回 true 吃掉事件。 */
            onMouseDown(event, pos, graphcanvas) {
                if (this.flags && this.flags.collapsed) return false;
                // 兼容 pointerdown / mousedown；抬起阶段不触发切换
                const isDown = !event || !event.type || !/up$|move/.test(event.type);
                const isLeft = !event || event.button === undefined || event.button === 0;
                if (this._pointInRect(pos, this.gearRect())) {
                    if (isDown && isLeft) {
                        this._toggleSettings(!this.settingsOpen);
                    }
                    return true;
                }
                // 颜色菜单打开时优先处理：菜单内点击选色
                if (this.openMenu) {
                    const mr = this.menuRect(this.openMenu);
                    if (this._pointInRect(pos, mr)) {
                        if (isDown && isLeft) this._handleMenuClick(pos);
                        return true;
                    }
                    // 点在任意颜色行上 → 交给下方行逻辑切换/收起；其他区域则关闭
                    const onColorRow = MENU_ROWS.some((rn) => this._pointInRect(pos, this._colorRowRect(rn)));
                    if (!onColorRow) this._toggleColorMenu(false);
                }
                if (this.settingsOpen) {
                    const pr = this.panelRect();
                    if (this._pointInRect(pos, pr)) {
                        // 三个颜色行：点击弹出下拉色卡
                        if (isDown && isLeft) {
                            for (const rowName of MENU_ROWS) {
                                if (this._pointInRect(pos, this._colorRowRect(rowName))) {
                                    const wasOpen = this.openMenu === rowName;
                                    this._toggleColorMenu(!wasOpen, rowName);   // 再点同一行 = 收起
                                    return true;
                                }
                            }
                        }
                        if (isDown) {
                            // ✕ 关闭按钮
                            if (pos[0] > pr[0] + pr[2] - 24 && pos[1] < pr[1] + PANEL_HEADER_H) {
                                this._toggleSettings(false);
                                return true;
                            }
                            return this._handlePanelClick(pos, event);
                        }
                        return true;   // 面板内悬停/滚轮也吞掉，避免误拖正文
                    }
                }
                return false;
 }

            /** 标题栏绘制：右侧齿轮（打开时高亮）；折叠态不画 */
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
                // 本版 litegraph 的 drawTitleText 不会复位 textAlign；
                // 不复位会污染后续标题文字绘制
                ctx.textAlign = "left";
            }

            /** 主体绘制：设置面板（展开时），纯 canvas，无 DOM */
            onDrawBackground(ctx) {
                // Vue 若重建过 DOM 编辑区（工作流加载 / widget 重挂载），样式会丢；
                // 借重绘检查标记位，缺样式则自动重放
                const ta0 = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                if (ta0 && ta0.dataset && ta0.dataset.tnStyled !== "1") this.applyNoteStyles();
                if (!this.settingsOpen || (this.flags && this.flags.collapsed)) return;
                const pr = this.panelRect();
                ctx.save();

                // 面板底
                ctx.fillStyle = "rgba(10,10,10,0.96)";
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(pr[0], pr[1], pr[2], pr[3], 6)
                              : ctx.rect(pr[0], pr[1], pr[2], pr[3]);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.16)";
                ctx.lineWidth = 1;
                ctx.stroke();

                // 头部
                ctx.fillStyle = "rgba(236,239,241,0.85)";
                ctx.font = "12px sans-serif";
                ctx.textAlign = "left";
                ctx.textBaseline = "middle";
                ctx.fillText("设置", pr[0] + PANEL_PAD + 4, pr[1] + PANEL_HEADER_H / 2);
                ctx.fillText(CLOSE, pr[0] + pr[2] - 14, pr[1] + PANEL_HEADER_H / 2);
                ctx.strokeStyle = "rgba(255,255,255,0.10)";
                ctx.beginPath();
                ctx.moveTo(pr[0] + 4, pr[1] + PANEL_HEADER_H);
                ctx.lineTo(pr[0] + pr[2] - 4, pr[1] + PANEL_HEADER_H);
                ctx.stroke();

                // 行
                const byName = {};
                for (const w of this.widgets || []) byName[w.name] = w;
                PANEL_ROWS.forEach((name, i) => {
                    const y = pr[1] + PANEL_HEADER_H + PANEL_PAD + i * PANEL_ROW_H;
                    const w = byName[name];
                    let valueText = "";
                    if (w) {
                        if (w.type === "toggle") valueText = w.value ? "开" : "关";
                        else valueText = String(w.value);
                    }
                    const midY = y + PANEL_ROW_H / 2;
                    ctx.fillStyle = "rgba(176,190,197,0.85)";
                    ctx.textAlign = "left";
                    ctx.fillText(name, pr[0] + PANEL_PAD + 4, midY);

                    const right = pr[0] + pr[2] - PANEL_PAD - 4;
                    if (NUM_ROWS[name]) {
                        // 三区：− ｜ 数字 ｜ ＋（符号位置即点击区）
                        ctx.textAlign = "left";
                        ctx.fillStyle = "rgba(236,239,241,0.75)";
                        ctx.fillText("−", right - 96, midY);
                        ctx.textAlign = "center";
                        ctx.fillStyle = "#ECEFF1";
                        ctx.fillText(valueText, right - 52, midY);
                        ctx.textAlign = "left";
                        ctx.fillStyle = "rgba(236,239,241,0.75)";
                        ctx.fillText("＋", right - 14, midY);
                    } else if (MENU_ROWS.includes(name)) {
                        // 三个颜色行：颜色名 + 小色块，左右排列
                        const palette = name === "背景颜色" ? BG_COLORS
                            : name === "边框颜色" ? BORDER_COLORS : FONT_COLORS;
                        const hex = labelValue(palette, valueText, name === "文字颜色" ? "#FFFFFF" : "#262626");
                        ctx.textAlign = "left";
                        ctx.fillStyle = "#ECEFF1";
                        ctx.fillText(valueText, right - 62, midY);
                        if (hex === "transparent") {
                            // 无/隐形：画斜线占位框
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
                        ctx.textAlign = "right";
                        ctx.fillStyle = "#ECEFF1";
                        ctx.fillText("‹ " + valueText + " ›", right, midY);
                    }
                    // 行分隔
                    if (i < PANEL_ROWS.length - 1) {
                        ctx.strokeStyle = "rgba(255,255,255,0.06)";
                        ctx.beginPath();
                        ctx.moveTo(pr[0] + 4, y + PANEL_ROW_H);
                        ctx.lineTo(pr[0] + pr[2] - 4, y + PANEL_ROW_H);
                        ctx.stroke();
                    }
                });
                ctx.restore();

                // 颜色下拉色卡（浮在最上层，最后画）
                if (this.openMenu) this._drawColorMenu(ctx, this.openMenu);
            }

            /** 颜色下拉色卡绘制（色块与名称左右排列；rowName = 文字/背景/边框颜色） */
            _drawColorMenu(ctx, rowName) {
                const name = rowName || this.openMenu || "文字颜色";
                const palette = name === "背景颜色" ? BG_COLORS
                    : name === "边框颜色" ? BORDER_COLORS : FONT_COLORS;
                const mr = this.menuRect(name);
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
                ctx.fillText(name, mr[0] + MENU_PAD + 2, mr[1] + MENU_HEADER / 2);
                const selected = (this.widgets || []).find((w) => w.name === name)?.value;
                for (const cell of this._menuCells()) {
                    // 左：色块；右：名称（同一行左右排列）
                    if (cell.c[1] === "transparent") {
                        ctx.strokeStyle = "rgba(128,128,128,0.8)";
                        ctx.lineWidth = 1;
                        ctx.strokeRect(cell.x + 4.5, cell.y + (cell.h - 12) / 2 - 0.5, 17, 13);
                        ctx.beginPath();
                        ctx.moveTo(cell.x + 4.5, cell.y + (cell.h - 12) / 2 + 12.5);
                        ctx.lineTo(cell.x + 21.5, cell.y + (cell.h - 12) / 2 - 0.5);
                        ctx.stroke();
                    } else {
                        ctx.fillStyle = cell.c[1];
                        ctx.fillRect(cell.x + 4, cell.y + (cell.h - 12) / 2, 16, 12);
                        if (cell.c[1] === "#FFFFFF" || cell.c[1] === "#000000") {
                            ctx.strokeStyle = "rgba(128,128,128,0.8)";
                            ctx.lineWidth = 1;
                            ctx.strokeRect(cell.x + 4.5, cell.y + (cell.h - 12) / 2 - 0.5, 17, 13);
                        }
                    }
                    if (cell.c[0] === selected) {
                        ctx.strokeStyle = MENU_SELECTED;
                        ctx.lineWidth = 2;
                        ctx.strokeRect(cell.x + 1.5, cell.y + 1.5, cell.w - 3, cell.h - 3);
                    }
                    ctx.fillStyle = "rgba(236,239,241,0.85)";
                    ctx.font = "11px sans-serif";
                    ctx.textAlign = "left";
                    ctx.fillText(cell.c[0], cell.x + 26, cell.y + cell.h / 2);
                }
                ctx.restore();
            }

            /** 把设置应用到正文 textarea 与节点外框；同时按开关显隐 textarea */
            applyNoteStyles() {
                const byName = {};
                for (const x of this.widgets || []) byName[x.name] = x;
                const v = (name, dft) => (byName[name] ? byName[name].value : dft);

                const fontColor = labelValue(FONT_COLORS, v("文字颜色", "白"), "#FFFFFF");
                const bgColor = labelValue(BG_COLORS, v("背景颜色", "墨蓝"), "#2E4A7A");
                let borderColor = labelValue(BORDER_COLORS, v("边框颜色", "深灰"), "#3A3A3A");
                const align = labelValue(ALIGN_OPTIONS, v("对齐", "居中"), "center");
                const fs = Number(v("字号", "16")) || 16;
                const lh = Number(v("行距", "1.4")) || 1.4;
                const bold = !!v("加粗", false);

                // 边框/背景映射到节点外框；"无/隐形" → 边框融入底色
                this.bgcolor = bgColor;
                this.color = borderColor === "transparent" ? bgColor : borderColor;

                const ta = this.textWidget && (this.textWidget.inputEl || this.textWidget.element);
                if (ta) {
                    const s = ta.style;
                    if (ta.dataset) ta.dataset.tnStyled = "1";   // 样式标记，供重绘自检
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
                    s.padding = "0";            // 无左右边距
                    s.boxSizing = "border-box";
                    s.width = "100%";
                    // 面板展开时锁定为预览区高度（与 computeSize 一致）；收起时填满节点
                    s.height = (this.settingsOpen && this._previewH)
                        ? this._previewH + "px"
                        : "100%";
                    s.resize = "none";
                }
                if (this.setDirtyCanvas) this.setDirtyCanvas(true, false);
            }

            /** 工作流加载 / 粘贴后：还原控件值 → 重放样式，并复位面板为收起 */
            onConfigure() {
                this.settingsOpen = false;
                this._previewH = null;
                if (this.textWidget) delete this.textWidget.computeSize;
                setTimeout(() => this.applyNoteStyles(), 0);
            }
        }

        LG.registerNodeType("TextNote", Object.assign(TextNoteNode, {
            title: "📝 便签 TextNote",
            collapsable: true,
        }));
        TextNoteNode.category = "utilities";   // 与官方 Note 同分类

        console.info("[TextNote] v3 便签已注册（纯正文 + 右上角齿轮设置）");
    },
});
