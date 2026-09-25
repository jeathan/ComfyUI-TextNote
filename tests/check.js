/* TextNote 断言测试（模拟浏览器，纯 Node 跑，无任何依赖）
 * 用法: node tests/check.js      （Node 18+；直接读 ../web/textnote_canvas.js）
 *
 * 覆盖：注册、i18n 文案、占位提示与旧版迁移、渲染层富文本（超链接/Markdown/灰字提示）、
 *       单击进编辑、光标落在点击处（含越界夹紧与不支持时的兜底）、拖动/链接不误触发、
 *       设置面板几何与绘制对齐（英文长颜色名不再压到色块上）。
 * 两条控件来源各跑一遍：真实 ComfyUI 的 ComfyWidgets.STRING 路径 + addWidget 回退路径。
 */
const fs = require("fs");
const path = require("path");
const SRC = path.resolve(__dirname, "..", "web", "textnote_canvas.js");

let pass = 0, fail = 0;
const ok = (cond, label) => {
    if (cond) { pass++; console.log("  PASS " + label); }
    else { fail++; console.log("  FAIL " + label); }
};

function makeEl(tag) {
    const el = {
        tagName: tag, style: {}, dataset: {}, children: [], value: "",
        placeholder: undefined, listeners: {},
        classList: { _s: new Set(), add(c) { this._s.add(c); }, contains(c) { return this._s.has(c); } },
        setAttribute() {}, removeAttribute() {},
        addEventListener(t, f) { (this.listeners[t] = this.listeners[t] || []).push(f); },
        appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
        remove() {}, closest() { return null; }, focus() { this.__focused = true; },
        setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; this.__selCalls = (this.__selCalls || 0) + 1; },
        getBoundingClientRect() { return this.__rect || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }; },
    };
    Object.defineProperty(el, "innerHTML", { get() { return this._html || ""; }, set(v) { this._html = v; } });
    Object.defineProperty(el, "lastElementChild", { get() { return this.children[this.children.length - 1] || null; } });
    return el;
}

/** 记录 fillText 调用的假 2D 上下文，用来断言面板是怎么画的（对齐/坐标） */
function makeCtx() {
    const state = {
        textAlign: "left", textBaseline: "alphabetic",
        font: "12px sans-serif", fillStyle: "", strokeStyle: "", lineWidth: 1,
    };
    const rec = { texts: [] };
    const noop = () => {};
    const ctx = {
        save: noop, restore: noop, beginPath: noop, closePath: noop, moveTo: noop, lineTo: noop,
        stroke: noop, fill: noop, rect: noop, arcTo: noop, strokeRect: noop, fillRect: noop,
        roundRect: noop, clearRect: noop, translate: noop,
        fillText(s, x, y) { rec.texts.push({ s: String(s), x, y, align: state.textAlign, font: state.font }); },
        measureText(s) { return { width: String(s).length * 6 }; },
    };
    for (const k of Object.keys(state)) {
        Object.defineProperty(ctx, k, { get: () => state[k], set: (v) => { state[k] = v; }, enumerable: true });
    }
    return { ctx, rec };
}

function loadModule({ withComfyWidgets }) {
    let src = fs.readFileSync(SRC, "utf8");
    src = src.replace(/^[ \t]*import .*$/m, "");      // 去掉 ESM import，改用注入的 app

    const cap = { raf: 0 };
    globalThis.window = globalThis;
    globalThis.LiteGraph = { registerNodeType: (n, cls) => { cap.name = n; cap.cls = cls; } };
    globalThis.LGraphNode = class {
        constructor() { this.widgets = []; this.properties = {}; this.flags = {}; }
        addWidget(type, name, value, cb, opts) {
            const w = { type, name, value, options: opts || {} };
            this.widgets.push(w);
            return w;
        }
        setDirtyCanvas() {}
    };
    globalThis.document = {
        head: makeEl("head"), body: makeEl("body"),
        getElementById() { return null; },
        createElement: (t) => makeEl(t),
        caretPositionFromPoint: null,
        caretRangeFromPoint: null,
    };
    // 同步化定时器/帧回调，测试里不需要真等待
    globalThis.setTimeout = (fn) => { fn(); return 0; };
    globalThis.requestAnimationFrame = (fn) => { cap.raf++; fn(); return 0; };
    try { Object.defineProperty(globalThis, "navigator", { value: { language: "zh-CN" }, configurable: true }); } catch {}

    if (withComfyWidgets) {
        globalThis.comfyAPI = { widgets: { ComfyWidgets: { STRING: (node, name, spec) => {
            // 模仿前端 createMultilineInputElement：default → value，placeholder → textarea
            const ta = makeEl("textarea");
            ta.value = spec[1].default;
            ta.placeholder = spec[1].placeholder;
            const w = { type: "customtext", name, value: ta.value, options: {}, element: ta, inputEl: ta };
            node.widgets.push(w);
            cap.spec = spec;
            return { widget: w };
        } } } };
    } else {
        delete globalThis.comfyAPI;
    }

    const app = { registerExtension(ext) { ext.registerCustomNodes(); } };
    const fn = new Function("app", src + "\nreturn { renderRichText, normalizeNoteText, LEGACY_PLACEHOLDER_TEXTS, I18N, CLICK_DRAG_TOLERANCE };");
    return { cap, api: fn(app) };
}

const noLink = { closest: () => null };
const linkTarget = { closest: (sel) => (sel === "a" ? {} : null) };

for (const mode of [true, false]) {
    console.log("\n=== ComfyWidgets 路径: " + (mode ? "有（真实 ComfyUI）" : "无（回退 addWidget）") + " ===");
    const { cap, api } = loadModule({ withComfyWidgets: mode });
    const node = new cap.cls();
    const textW = node.widgets.find((w) => w.name === "text");
    const ZH = api.I18N.zh.defaultText;
    const EN = api.I18N.en.defaultText;

    /* ---------- 注册与默认值 ---------- */
    ok(cap.name === "TextNote", "节点注册名 TextNote");
    ok(!!textW, "存在 text 正文控件");
    ok(textW.value === "", "新建便签正文默认为空字符串（不需要再删提示文字）");
    ok(textW.options.hideOnZoom === false, "正文控件 hideOnZoom=false");

    /* ---------- 提示文案：v4.3 改成了「单击」 ---------- */
    ok(ZH.includes("单击即可输入"), "中文提示是「单击即可输入」");
    ok(!ZH.includes("双击"), "中文提示不再写「双击」");
    ok(EN.includes("Click to edit"), "英文提示是 Click to edit");
    ok(!EN.includes("Double-click"), "英文提示不再写 Double-click");
    if (mode) ok(cap.spec[1].placeholder === ZH, "STRING spec 带上 placeholder（前端原生写入 textarea）");

    /* ---------- 空便签的灰色占位提示 ---------- */
    const hint = api.renderRichText("");
    ok(hint.includes("在这里写说明、备注…"), "空便签渲染出中文占位提示");
    ok(hint.includes("white-space:pre-wrap"), "占位提示保留换行（pre-wrap）");
    ok(hint.includes("opacity:.45"), "占位提示为灰色弱化显示");
    ok(api.renderRichText("   ").includes("在这里写说明"), "纯空白也按空便签处理");
    ok(!api.renderRichText("# 我的标题").includes("在这里写说明"), "有正文时不再显示占位提示");
    ok(api.renderRichText("**粗**").includes("<b>粗</b>"), "加粗渲染仍正常");
    ok(api.renderRichText("[标题](https://a.com)").includes('href="https://a.com"'), "超链接渲染仍正常");

    /* ---------- 旧工作流占位提示清理（覆盖所有已发布文案） ---------- */
    for (const old of [
        "在这里写说明、备注…",
        "Write notes and remarks here",
        "  在这里写说明、备注…  ",
        "Write notes and remarks here\r\n",
        "在这里写说明、备注…\n双击编辑；支持 [标题](链接) 超链接",
        "Write notes here…\r\nDouble-click to edit; [label](link) supported  ",
    ]) {
        textW.value = old;
        ok(node._clearLegacyPlaceholder() === true && textW.value === "",
            "旧版提示被识别并清空: " + JSON.stringify(old.slice(0, 22)) + "…");
    }
    const keep = "在这里写说明、备注…\n双击编辑；支持 [标题](链接) 超链接我的补充";
    textW.value = keep;
    ok(node._clearLegacyPlaceholder() === false, "用户改过的文字不会被误清");
    ok(textW.value === keep, "误清检查后正文保持原样");
    textW.value = "便签备注";
    ok(node._clearLegacyPlaceholder() === false, "普通正文不受影响");

    /* ---------- 渲染层 ---------- */
    node._renderDiv = makeEl("div");
    textW.value = "";
    node._renderIntoDiv();
    ok(node._renderDiv.innerHTML.includes("在这里写说明"), "_renderIntoDiv 空正文 → 占位提示");
    ok(node._renderDiv.__lastText === "", "渲染层缓存 __lastText 为空字符串");
    textW.value = "在这里写说明、备注…\n双击编辑；支持 [标题](链接) 超链接";
    node._renderIntoDiv();
    ok(textW.value === "" && node._renderDiv.innerHTML.includes("在这里写说明"),
        "_renderIntoDiv 自动清掉旧占位提示后再渲染");

    /* ---------- 单击进编辑 + 光标落点 ---------- */
    const ta = makeEl("textarea");
    ta.parentElement = makeEl("div");
    node.textWidget.inputEl = ta;
    node.textWidget.element = ta;
    textW.value = "第一行\n第二行 hello";
    ta.value = textW.value;
    node.applyNoteStyles();
    const div = node._renderDiv;
    ok(!!(div.listeners.click && div.listeners.click.length), "渲染层绑定了单击（click）事件");
    ok(!div.listeners.dblclick, "不再依赖双击（dblclick）");

    const click = (x, y, target) => {
        (div.listeners.mousedown || []).forEach((f) => f({ clientX: x, clientY: y, target: target || noLink }));
        (div.listeners.click || []).forEach((f) =>
            f({ clientX: x, clientY: y, target: target || noLink, stopPropagation() {} }));
    };

    // 点击坐标 → 浏览器报出的字符下标 → 光标应落在那里
    globalThis.document.caretPositionFromPoint = () => ({ offsetNode: ta, offset: 6 });
    node._editMode = false;
    click(120, 60);
    ok(node._editMode === true, "单击正文 → 进入编辑态");
    ok(ta.__focused === true, "进入编辑态后 textarea 获得焦点");
    ok(ta.selectionStart === 6 && ta.selectionEnd === 6, "光标落在点击处（下标 6，无需方向键）");

    // 越界下标要被夹到 [0, len]
    globalThis.document.caretPositionFromPoint = () => ({ offsetNode: ta, offset: 9999 });
    node._editMode = false;
    click(120, 60);
    ok(ta.selectionStart === ta.value.length, "越界下标被夹到正文末尾");
    globalThis.document.caretPositionFromPoint = () => ({ offsetNode: ta, offset: -5 });
    node._editMode = false;
    click(120, 60);
    ok(ta.selectionStart === 0, "负下标被夹到 0");

    // 点正文最后一行下方空白 → 光标到末尾
    const lastLine = makeEl("div");
    lastLine.__rect = { left: 0, top: 0, right: 100, bottom: 40, width: 100, height: 20 };
    div.appendChild(lastLine);
    globalThis.document.caretPositionFromPoint = () => ({ offsetNode: ta, offset: 4 });
    node._editMode = false;
    click(50, 90);
    ok(ta.selectionStart === ta.value.length, "点最后一行下方的空白 → 光标到正文末尾");

    // 不支持 caretPositionFromPoint 的浏览器：兜底 + 下一帧重试
    globalThis.document.caretPositionFromPoint = null;
    globalThis.document.caretRangeFromPoint = () => ({ startContainer: document.body, startOffset: 2 });
    const rafBefore = cap.raf;
    node._editMode = false;
    click(50, 10);
    ok(node._editMode === true, "命中失败也能进编辑态（不卡住）");
    ok(cap.raf > rafBefore, "命中失败会安排下一帧重试");

    // 兜底是按行高估算行号，而不是傻跳到末尾
    div.children.length = 0;        // 清掉上面用于测「点最后一行下方」的假元素
    ta.__rect = { left: 0, top: 100, right: 300, bottom: 250, width: 300, height: 150 };
    textW.value = "第一行aaa\n第二行bbb\n第三行ccc";
    ta.value = textW.value;
    globalThis.document.caretRangeFromPoint = null;      // 完全命中不到
    node._editMode = false;
    click(50, 130);                                      // 130 = top + 20*1.5 → 第 2 行
    ok(ta.selectionStart === "第一行aaa".length + 1,
        "命中不到时兜底到点击所在行的行首（不是末尾）");
    node._editMode = false;
    click(50, 240);                                      // 最后一行之下 → 末尾
    ok(ta.selectionStart === ta.value.length, "点在正文最后一行之下时兜底到末尾");
    ta.__rect = null;
    ta.value = "";

    // 兼容 caretRangeFromPoint 返回 textarea 内部文本节点的情况
    textW.value = "abcdef";
    ta.value = textW.value;
    const inner = makeEl("#text");
    inner.nodeType = 3;
    inner.parentElement = { closest: (sel) => (sel === "textarea" ? ta : null) };
    globalThis.document.caretRangeFromPoint = () => ({ startContainer: inner, startOffset: 3 });
    node._editMode = false;
    click(50, 10);
    ok(ta.selectionStart === 3, "caretRangeFromPoint 返回 textarea 内文本时也能定位");

    /* ---------- 链接 / 拖动 不误触发编辑 ---------- */
    globalThis.document.caretPositionFromPoint = () => ({ offsetNode: ta, offset: 2 });
    let stopped = false;
    node._editMode = false;
    (div.listeners.mousedown || []).forEach((f) => f({ clientX: 10, clientY: 10, target: linkTarget }));
    (div.listeners.click || []).forEach((f) =>
        f({ clientX: 10, clientY: 10, target: linkTarget, stopPropagation() { stopped = true; } }));
    ok(node._editMode === false, "点超链接不进编辑态（照常打开链接）");
    ok(stopped === true, "点超链接阻止冒泡（不触发画布拖动）");

    node._editMode = false;
    (div.listeners.mousedown || []).forEach((f) => f({ clientX: 10, clientY: 10, target: noLink }));
    (div.listeners.click || []).forEach((f) =>
        f({ clientX: 10 + api.CLICK_DRAG_TOLERANCE + 20, clientY: 10, target: noLink, stopPropagation() {} }));
    ok(node._editMode === false, "按下后拖动超过阈值 → 不进编辑态（可继续挪节点）");

    node._editMode = false;
    (div.listeners.mousedown || []).forEach((f) => f({ clientX: 10, clientY: 10, target: noLink }));
    (div.listeners.click || []).forEach((f) =>
        f({ clientX: 10 + api.CLICK_DRAG_TOLERANCE - 1, clientY: 10, target: noLink, stopPropagation() {} }));
    ok(node._editMode === true, "阈值内的轻微抖动仍算单击");

    /* ---------- 样式与面板 ---------- */
    node._editMode = false;
    node.applyNoteStyles();
    ok(ta.placeholder === ZH, "textarea placeholder 设置为提示文案");
    ok(ta.classList.contains("tn-textnote-input"), "textarea 打上样式类（::placeholder 跟随文字色）");
    ta.value = "SENTINEL";                 // 插件不得往 value 里写任何东西（尤其提示文案）
    node.applyNoteStyles();
    ok(ta.value === "SENTINEL", "applyNoteStyles 不碰 textarea 的 value（提示不进正文）");
    ok(ta.value !== ZH, "提示文案没有被塞进 textarea");
    ta.value = "";

    node._renderDiv = makeEl("div");
    node._previewH = 160;
    node.settingsOpen = true;
    node.applyNoteStyles();
    ok(node._renderDiv.style.display === "", "齿轮面板展开时渲染层仍显示（正文预览不空白）");
    ok(node._renderDiv.style.opacity === "1", "非编辑态渲染层不透明");
    node._editMode = true;
    node.applyNoteStyles();
    ok(node._renderDiv.style.opacity === "0", "编辑态渲染层透明，让位给 textarea");
    ok(node._renderDiv.style.height === "160px", "预览区高度跟面板展开高度一致（不与面板重叠）");
    node._editMode = false;
    node.settingsOpen = false;

    /* ---------- 面板绘制：颜色名不能被色块挤掉（英文长名字曾压到色块上） ---------- */
    node.settingsOpen = true;
    node._previewH = 180;
    node.openMenu = null;
    const { ctx: mockCtx, rec } = makeCtx();
    node.applyNoteStyles();
    node.onDrawBackground(mockCtx);

    const pr = node.panelRect();
    const rightEdge = pr[0] + pr[2] - 8 - 4;            // 与绘制侧一致的 right
    const colorNames = ["白", "墨蓝", "深灰", "White", "Ink blue", "Dark gray"];
    const drawnColors = rec.texts.filter((x) => colorNames.includes(x.s));
    ok(drawnColors.length >= 3, "面板画出了三行颜色名（当前有 " + drawnColors.length + " 行）");
    ok(drawnColors.every((x) => x.align === "right"), "颜色名右对齐（长名字不再往右长、压到色块上）");
    ok(drawnColors.every((x) => Math.abs(x.x - (rightEdge - 24)) < 0.01),
        "颜色名右端固定在色块左侧 6px（色块占 right-18 … right）");
    const sizeText = rec.texts.find((x) => x.s === "16");
    ok(!!sizeText && sizeText.align === "center", "字号数值仍居中显示（没被顺手改掉）");
    ok(rec.texts.some((x) => x.s === "设置" || x.s === "Settings"), "面板标题仍然绘制");
    node.settingsOpen = false;

    ok((() => { try { node._syncRenderDiv(); return true; } catch (e) { console.log(e); return false; } })(),
        "_syncRenderDiv 无 textarea 时不抛错");
}

console.log("\n总计: " + pass + " passed, " + fail + " failed");
process.exit(fail ? 1 : 0);
