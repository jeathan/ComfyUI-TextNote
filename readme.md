# ComfyUI-TextNote

📝 Canvas sticky-note node for ComfyUI — write text notes / annotations next to your nodes. Like the built-in *Note* node, but fully styleable.

**中文说明见下方 / [中文说明](#中文说明)**

![version](https://img.shields.io/badge/version-3.7.0-blue) ![ComfyUI](https://img.shields.io/badge/ComfyUI-0.35%2B-green) ![license](https://img.shields.io/badge/license-MIT-orange)

---

## English

### What is this?

A **pure-frontend custom node** that lives on your ComfyUI canvas as a sticky note:

- **No inputs, no outputs, never executed** (`isVirtualNode`) — it costs nothing at run time
- Text and all style settings are **saved inside the workflow JSON** (`serialize_widgets`)
- The node body **is** a multi-line text editor — WYSIWYG, works with CJK input methods
- All settings live behind a **⚙ gear button** in the node title bar; the settings panel opens **below the note body**, so you can watch the text update live while you tweak
- Chinese line-breaking (per-character) + English word wrapping built in

### Style controls

| Setting | Interaction |
|---|---|
| Font size | `−` / `＋` buttons (step 2, range 8–128) or **type a number** in the middle and press Enter |
| Line spacing | Same three-zone interaction (step 0.1, range 0.8–3) |
| Text color | Click the row → dropdown palette: 14 high-saturation colors + white + black |
| Background color | Dropdown palette: 16 **medium-saturation dark** colors (navy / ink blue / peacock blue / teal / pine green / ochre / wine red / aubergine …) |
| Border color | Dropdown palette: none/invisible + 15 dark neutral & morandi tones; "none" melts the border into the background |
| Align | Left / center / right (also vertical: top / middle / bottom) |
| Bold | Toggle |

Palette rows display as **color-name + small swatch side by side**; click a swatch to apply instantly; click outside (or the same row again) to close. Other rows cycle with left-click, reverse with right-click.

### Install

Copy / clone into your ComfyUI `custom_nodes` folder and restart:

```
ComfyUI/custom_nodes/ComfyUI-TextNote/
```

No dependencies beyond what ComfyUI already ships (nothing to pip-install).

### Use

1. Restart ComfyUI (or just reload the browser page)
2. Double-click empty canvas → search **`TextNote`** or **`便签`** (category `utilities`, next to the built-in Note)
3. Type your note; click the **⚙** in the top-right corner of the title bar to style it

### Notes & compatibility

- Developed and tested against **ComfyUI 0.35.1 / frontend 1.51.10**; the node uses standard `LGraphNode` + `registerCustomNodes` extension APIs
- Tested with 30+ mocked-browser assertions covering registration, palettes, panel geometry, and click hit-zones
- Font stack: system UI fonts (Microsoft YaHei / PingFang SC / Segoe UI) — no font files needed on Windows/macOS

### Customize

Edit `web/textnote_canvas.js`:

- `FONT_COLORS` / `BG_COLORS` / `BORDER_COLORS` — the three palettes (`[label, hex]` pairs)
- `NUM_ROWS` — min/max/step for font-size and line-spacing rows
- Refresh the browser page after editing.

---

## 中文说明

### 这是什么？

一个**纯前端的画布便签节点**：像官方 Note 一样摆在节点旁边写说明、做标注——

- **没有输入口、没有输出口、不参与执行**（虚拟节点），跑工作流零开销
- 正文和全部样式**随工作流 JSON 一起保存**，分享 / 拷贝不丢
- 便签本体就是多行编辑区，所见即所得，中文输入法无障碍
- 所有参数收进标题栏右上角的 **⚙ 齿轮**；设置面板打开在**正文下方**，边调边看效果，不遮挡文字
- 中文逐字断行 + 英文整词换行

### 可调样式

| 设置项 | 交互方式 |
|---|---|
| 字号 | 左 `−` 递减 / 右 `＋` 递增（步长 2，范围 8–128），点中间**直接输入数字**回车确认 |
| 行距 | 同上三区交互（步长 0.1，范围 0.8–3） |
| 文字颜色 | 点击行弹出下拉色卡：14 个高饱和色 + 白 + 黑（大红、柠檬黄等） |
| 背景颜色 | 下拉色卡：**16 个中等饱和度深色**（藏青 / 墨蓝 / 孔雀蓝 / 青碧 / 松柏绿 / 赭石 / 酒红 / 绛紫……） |
| 边框颜色 | 下拉色卡：无/隐形 + 深色中性/莫兰迪 15 色；选「无/隐形」边框融入底色 |
| 对齐 | 左 / 中 / 右（另有垂直对齐：上 / 中 / 下） |
| 加粗 | 开关 |

三个颜色行统一为「**颜色名 + 小色块**」左右排列显示；点色块立即生效，点菜单外或再点同一行关闭。其余选项左键循环、右键反向。

### 安装

复制 / 克隆到 ComfyUI 的 `custom_nodes` 目录后重启：

```
ComfyUI/custom_nodes/ComfyUI-TextNote/
```

无需 pip 安装任何东西——只用 ComfyUI 自带环境。

### 使用

1. 重启 ComfyUI（或刷新浏览器页面）
2. 双击画布空白处搜索 **`便签`** 或 **`TextNote`**（`utilities` 分类，官方 Note 旁边）
3. 直接写字；点标题栏右上角 **⚙** 调样式

### 兼容性

- 在 **ComfyUI 0.35.1 / 前端 1.51.10** 上开发并实测；使用标准 `LGraphNode` + `registerCustomNodes` 扩展 API
- 30+ 项模拟浏览器断言覆盖注册、色板、面板几何与点击命中区

### 自定义

编辑 `web/textnote_canvas.js`：

- `FONT_COLORS` / `BG_COLORS` / `BORDER_COLORS` — 三张色表（`[名称, hex]`）
- `NUM_ROWS` — 字号/行距的最小值、最大值、步长
- 改完刷新浏览器页面即可。

## License / 许可

MIT
