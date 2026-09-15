# -*- coding: utf-8 -*-
"""ComfyUI-TextNote v2 — 画布便签节点（纯前端扩展）

节点本体由 web/textnote_canvas.js 在浏览器端注册：
- 无输入口 / 输出口，不参与执行队列（isVirtualNode）
- 文字与样式随工作流 JSON 保存
- 字体大小、文字/背景/边框颜色、左中右对齐、行距、左右边距可调

Python 侧仅负责向 ComfyUI 声明前端扩展目录（WEB_DIRECTORY），
不注册任何执行节点，因此不占用显存、不出现在执行图里。
"""

WEB_DIRECTORY = "./web"

__version__ = "2.0.0"
__all__ = ["WEB_DIRECTORY", "__version__"]

NODE_CLASS_MAPPINGS = {}        # 纯前端节点，无 Python 执行类
NODE_DISPLAY_NAME_MAPPINGS = {}
