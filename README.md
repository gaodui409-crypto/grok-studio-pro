# Grok Studio Pro

Grok Studio Pro 是一个运行在浏览器里的 AI 图片、视频工作台。项目基于 TanStack Start、React 19 和 Tailwind CSS v4，目前正在从 xAI 专用工具改造为多渠道聚合工具。

> 旧版演示：<https://grok-muse-canvas.lovable.app>

## 功能

- 文生图：输入提示词，一次生成 1–10 张图片。
- 图生图：支持单图编辑和最多 4 张图的融合。
- 视频：支持文生视频、图生视频、视频编辑和视频延长。
- 同人图批量：按“场景 → 服装 → 动作”组合生成，可使用内置或自定义角色预设。
- 漫画工具：批量上色，或先识别翻译文字，再将译文嵌回图片。
- 画廊：生成结果自动存入 IndexedDB，可筛选、预览、删除或打包下载。
- 状态保持：页面切换时保留输入和任务进度。

## 渠道支持

| 渠道         | 文生图 | 图生图 | 视频 | 配置和限制                                                   |
| ------------ | :----: | :----: | :--: | ------------------------------------------------------------ |
| xAI / NewAPI |   是   |   是   |  是  | 需要 API Key；Base URL 可填 xAI 官方地址或兼容的 NewAPI 中转 |
| ModelScope   |   是   |   否   |  否  | 需要 ModelScope Token，固定使用 `Tongyi-MAI/Z-Image-Turbo`   |
| Hugging Face |   是   |   否   |  否  | 需要 HF Token，模型可自定义                                  |
| AI Horde     |   是   |   否   |  否  | 可留空 Key 使用匿名队列；匿名任务优先级较低                  |
| Pollinations |   是   |   否   |  否  | 需要 API Key / Pollen 额度，默认模型为 `flux`                |
| PixAI 号池   | 待接入 |   否   |  否  | 已登记 `imgapi.qianyimwl.top`，但缺少真实的网页请求协议      |

PixAI 号池目前只完成了渠道注册和设置界面。生成时会明确提示缺少协议，不会对网站猜测发包。要完成接入，需要从浏览器 DevTools Network 导出一次成功生成的 HAR，或提供以下信息：

- 提交生成任务的 URL、方法、请求头和请求体。
- 提交后的响应内容，以及任务 ID 所在字段。
- 轮询状态和获取最终图片的请求、响应。
- Cookie、Token 或其他登录态的传递方式。提供样例时应先将真实凭证打码。

## 快速开始

### 环境要求

- 建议使用 Node.js 22。
- 也可使用 Bun。
- 需要现代浏览器，并允许 `localStorage` 和 IndexedDB。

### 使用 npm

```bash
npm install
npm run dev
```

默认地址是 <http://localhost:5173>。如果端口已被占用，Vite 会在终端显示新地址。

### 使用 Bun

```bash
bun install
bun run dev
```

## 使用说明

### 1. 配置生成渠道

1. 打开左侧的“设置”，或直接访问 `/settings`。
2. 在“图片生成来源”中选择渠道。
3. 填写当前渠道所需的 Key、Token、Base URL 或模型名。
4. 设置并发数、默认画面比例和分辨率，然后点击“保存设置”。

各渠道的配置方式：

- xAI / NewAPI：填写 API Key 和 API 代理地址。官方地址是 `https://api.x.ai`；NewAPI 中转必须兼容项目使用的 `/v1/images/*`、`/v1/videos/*` 和 `/v1/chat/completions` 路径。
- ModelScope：填写 ModelScope Access Token。该渠道使用异步任务，排队时需等待轮询完成。
- Hugging Face：填写 HF Token 和模型 ID，例如 `Tongyi-MAI/Z-Image-Turbo`。
- AI Horde：Key 可以留空，程序会使用匿名 Key `0000000000`。如果有个人 Key，填入后可获得更高的队列优先级。
- Pollinations：填写 Pollinations API Key 和模型名。该服务按 API Key / Pollen 额度运行，不应当作无限免费渠道。
- PixAI 号池：目前仅保存网站地址，尚不能生成图片。

Key 和 Token 仅保存在当前浏览器的 `localStorage` 中。发起生成时，它们会直接发送给你选中的 Provider 或 NewAPI 中转。请勿在公共电脑上保存私人凭证。

### 2. 设置并发数

“并发请求数”主要影响同人图、漫画上色和漫画翻译的批量任务。

- 使用共享免费渠道，或同时在其他会话中生成时，建议设为 `1`。
- ModelScope 建议不超过 `3`。
- 出现 `429`、限频或长时间排队时，先降低并发数。

### 3. 文生图

1. 打开“文生图”。
2. 输入提示词，选择生成数量、画面比例和分辨率。
3. xAI / NewAPI 可在页面中选择图片模型；其他渠道使用设置页里的固定或自定义模型。
4. 点击“生成图片”。完成后结果会自动保存到画廊。

文生图是 AI Horde、Pollinations、ModelScope 和 Hugging Face 的主要使用入口。AI Horde 任务可能长时间停留在队列中，这通常不是程序故障。

### 4. 图生图和多图融合

> 此页面目前只支持 xAI / NewAPI。

1. 打开“图生图”，上传 1–4 张参考图。
2. 输入编辑指令。多图时可使用 `<IMAGE_0>`、`<IMAGE_1>` 引用对应图片。
3. 选择数量、分辨率和图片模型，然后点击“生成”。

### 5. 视频生成

> 视频目前只支持 xAI / NewAPI。

- 文生视频：输入提示词，选择时长、比例和 `480p` / `720p`。
- 图生视频：需要 1 张起始帧，可再上传最多 7 张参考图。
- 视频编辑：上传 2–15 秒的 MP4，或填写可访问的视频 URL。
- 视频延长：上传源视频，填写后续内容和延长时长。

提交后页面会轮询任务状态。完成的视频会自动存入画廊，也可以单独下载。

### 6. 同人图批量

1. 选择角色预设，或填写角色名、角色描述和参考图。
2. 在场景树中新建场景，并为场景添加服装和动作。
3. 选择画风、光影和生成模式。
4. “单场景精细”会生成当前场景的“服装 × 动作”组合；“多场景混合”会按场景依次生成。
5. 核对预计图片数和并发数，然后开始批量生成。

未上传角色参考图时，可使用所有已启用的文生图渠道。需要参考图编辑时，请切换到 xAI / NewAPI。

### 7. 漫画上色和翻译

> 漫画上色和翻译都需要 xAI / NewAPI。翻译模式还会调用多模态 Chat Completion。

- 上色：批量上传黑白漫画，选择上色风格，可选上传配色参考图，然后开始上色。
- 翻译：选择源语言和目标语言。每页先识别、翻译气泡文字，再通过图片编辑把译文嵌回原图。
- 完成后可以下载单页，或将全部结果打包为 ZIP。

### 8. 画廊和本地存储

画廊数据保存在当前浏览器的 IndexedDB 中。可按类型、场景、角色和提示词筛选，也可以：

- 打开大图或视频预览，用左右方向键切换。
- 复制已使用的提示词。
- 下载单个结果，或选中多项后打包为 ZIP。
- 删除选中项目或清空画廊。

清理浏览器网站数据会同时删除设置和画廊。重要结果应先下载到本地。

## 常见问题

### 页面提示“尚未配置”

打开设置页，填写当前渠道的 Key 或 Token 并保存。AI Horde 允许留空 Key，PixAI 的提示则表示请求协议还没有完成。

### 页面提示“当前来源不支持此功能”

图生图、视频和漫画工具依赖 xAI / NewAPI。切换渠道后再重试。

### AI Horde 长时间显示生成中

匿名任务优先级最低，社区工作节点少时会等待较久。可以取消任务，稍后重试，或填写个人 AI Horde Key。

### Pollinations 返回 401、402 或 429

检查 API Key、Pollen 额度和请求频率。批量生成时可先将并发数设为 `1`。

### NewAPI 返回 404 或模型不存在

确认 Base URL 没有重复拼接 `/v1`，并检查中转是否支持当前的图片或视频端点。模型名必须与中转实际提供的名称一致。

### 浏览器报 CORS 错误

项目从浏览器直接请求 Provider。目标 API 必须允许当前页面的 Origin、请求头和 HTTP 方法。无法修改目标服务时，需要在自己的后端或 NewAPI 中转处理 CORS。

### 画廊保存失败或空间不足

先下载需要保留的内容，再删除旧项目。无痕模式、浏览器存储限制和手动清理网站数据都可能导致 IndexedDB 数据丢失。

## 开发命令

```bash
npm run test     # 单元测试
npm run lint     # ESLint
npm run build    # 生产构建
npm run preview  # 本地预览生产构建
```

## 关键路径

```text
src/
  routes/                  # 页面路由
  lib/
    providers/             # 各图片渠道的适配器和注册表
    ai-horde-client.ts      # AI Horde 提交、轮询和结果处理
    pollinations.ts         # Pollinations 请求和图片归一化
    settings.ts             # Provider 目录、能力和本地设置
    xai.ts                  # 路由兼容门面，也包含视频和 Chat 调用
    gallery-db.ts           # IndexedDB 画廊
    app-store.ts            # Zustand 页面状态
    character-presets.ts    # 角色预设
    scene-tree.ts           # 同人图场景树
    concurrency.ts          # 批量任务并发控制
  components/
    api-key-banner.tsx      # 未配置或未就绪提示
    provider-banner.tsx     # Provider 功能不支持提示
```

## License

MIT
