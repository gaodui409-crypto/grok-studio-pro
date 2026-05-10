# Grok Studio

一个面向创作者的多 Provider AI 图像 / 视频工作台，基于 TanStack Start + React 19 + Tailwind v4 构建。

> 演示：<https://grok-muse-canvas.lovable.app>

## ✨ 功能

- **文生图**：输入提示词生成图片，支持 1–10 张批量
- **图生图 / 编辑**：单图编辑或多图融合（`<IMAGE_0>` 占位符）
- **视频生成**：文生视频 / 图生视频 / 视频编辑 / 视频延长，5 秒轮询进度
- **同人图批量**：层级场景树（场景 → 服装 → 动作）+ 内置角色预设（胡桃、雷神、甘雨、纳西妲、七濑胡桃 等）
- **漫画工具**：批量上色 + OCR/翻译嵌字（多模态 chat 提取 → 图片编辑替换文字）
- **画廊**：所有生成结果自动入 IndexedDB，瀑布流展示、按场景/角色/类型/Provider 筛选、左右键浏览、批量打包 zip
- **状态保持**：基于 Zustand 全局 store，切 Tab 不丢输入与生成进度

## 🌐 多 Provider 支持

设置页顶部选择「图片生成来源」，可在三种 Provider 之间一键切换，所有配置独立保存：

| Provider | 模型 | 文生图 | 图生图 | 视频 | 备注 |
|---|---|:-:|:-:|:-:|---|
| **xAI / NewAPI 中转** | `grok-imagine-image` / `grok-imagine-image-pro` / `grok-imagine-video` | ✅ | ✅ | ✅ | Base URL 可填 `https://api.x.ai` 或自有 NewAPI 中转地址 |
| **魔搭 ModelScope** | `Tongyi-MAI/Z-Image-Turbo`（异步） | ✅ | ❌ | ❌ | 免费 2000/天，并发 ≤3，POST `/v1/images/generations` 取 `task_id`，GET `/v1/tasks/{id}` 轮询 |
| **Hugging Face** | `Tongyi-MAI/Z-Image-Turbo` / `black-forest-labs/FLUX.1-Krea-dev` / 自定义 | ✅ | ❌ | ❌ | 免费用户约 80 次/天，POST `/models/{model}` 返回二进制 PNG |

不支持的功能 Tab 会显示黄色提示条，引导切换 Provider；画廊每张图也会标记来源。

## 🚀 本地开发

```bash
bun install
bun run dev   # http://localhost:5173
```

## 🔑 配置

打开 `/settings` 配置：

- **图片生成来源**：xAI / ModelScope / HF（互斥）
- **API Key / Token**：分 Provider 独立保存于 `localStorage`
- **并发请求数**（1–10）：所有批量任务共用
- **默认比例 / 分辨率**：xAI 用 `aspect_ratio + 1k/2k`，其它 Provider 自动转换为 `width × height`
- **角色预设管理**：内置 5 个角色 + 用户自定义

所有配置仅保存在浏览器，不上传任何服务器。

## 📁 关键路径

```
src/
  routes/         # TanStack 文件路由：index / edit / video / fanart / comic / gallery / settings
  lib/
    settings.ts          # Provider 类型 + localStorage
    xai.ts               # 统一 generateImages/editImages/generateVideo，按 Provider 分发
    gallery-db.ts        # IndexedDB Gallery
    app-store.ts         # Zustand 全局状态（Tab 切换不丢失）
    character-presets.ts # 角色预设
    scene-tree.ts        # 场景树
    concurrency.ts       # 并发控制
  components/
    api-key-banner.tsx       # 缺 Key 提示
    provider-banner.tsx      # 当前 Provider 不支持此功能 提示
    app-sidebar.tsx          # 左侧固定侧边栏
```

## 📜 License

MIT
