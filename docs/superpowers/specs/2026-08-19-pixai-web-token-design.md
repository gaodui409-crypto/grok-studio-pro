# PixAI 网页 Token Provider 设计

## 背景

项目已经接入 PixAI v2 官方 API，但官方 API Key 需要申请，公开免费额度未知，不能当作免费渠道。PixAI 网页本身使用登录态 Bearer Token 调用 `https://api.pixai.art/graphql`，用户希望把自己的免费号或账号额度接入聚合工作台。

## 目标

- 增加独立的 `pixai-web` 文生图 Provider，使用用户手工提供的 PixAI 网页 Bearer Token。
- 通过 GraphQL `createGenerationTask` 创建任务，查询 `task` 状态，从 `outputs` 中取得媒体 ID，再查询 `media` 取得公开图片 URL。
- 多图请求在 Provider 内逐张串行，尊重 PixAI 账号和当前会话的并发限制。
- 让用户自行填写模型 ID；默认值使用当前项目已有的 Tsubaki.2 ID，失效时无需改代码。
- 在设置页和 README 中明确：这是用户自备网页 Token 的实验性渠道，不是官方 API Key，也不是号池自动轮换。

## 非目标和安全边界

- 不实现网页登录、密码登录、注册、验证码处理、Cookie 抓取或 LocalStorage 自动读取。
- 不实现批量注册、临时邮箱、自动领取积分、账号轮换、机器人检测规避或绕过服务限制。
- 不把 `imgapi.qianyimwl.top` 号池与网页 Token Provider 合并；号池仍需真实 HAR/Network 协议。
- 不复制无许可证仓库的代码；仅根据公开 GraphQL schema 组织最小请求。
- 不把网页 Token 宣传为公开免费 API。Token 由用户自行提供并只存储在当前浏览器 localStorage。

## 协议和数据流

1. 前端从设置读取 `pixaiWebToken` 和 `pixaiWebModelId`。
2. `POST https://api.pixai.art/graphql`，请求头为 `Authorization: Bearer <token>`、`Content-Type: application/json`。
3. mutation 使用 `createGenerationTask(parameters: JSONObject!)`，参数包含 prompt、negativePrompts、samplingSteps、samplingMethod、cfgScale、width、height、clipSkip、modelId、controlNets、extra 和 priority。
4. 从 `data.createGenerationTask.id` 取得任务 ID。
5. 以 3 秒以上间隔查询 `task(id: ID!) { id status outputs }`，兼容 waiting/pending/started/processing/running/queued 与 completed/success/succeeded/done，以及 failed/error/cancelled/canceled。
6. 完成后从 `outputs.mediaId` 或 `outputs.batch[].mediaId` 提取媒体 ID，逐个调用 `media(id: String!) { fileUrl urls { variant url } }`，优先 `PUBLIC` URL，再回退 `fileUrl` 或任意 URL。
7. 将 URL 转换为统一的 `GeneratedImage[]`。

当前无法从本机连通 `api.pixai.art:443`，因此上述协议仅以公开代码和既有网页调用样例为依据，必须在用户自己的 Token 环境中验收；协议变化时 Provider 应给出可读错误，而不是静默返回空图。

## 架构

- `src/lib/pixai-web-client.ts`：只负责 GraphQL HTTP、错误解析、任务轮询、媒体 URL 提取、超时和取消。
- `src/lib/providers/pixai-web.ts`：把项目通用图片参数映射成 GraphQL 参数，并从设置读取凭证。
- `src/lib/settings.ts`：增加 Provider ID、能力目录、Token/模型 ID 持久化字段和配置检查。
- `src/routes/settings.tsx`：增加网页 Token 和模型 ID 输入框，并说明凭证来源和风险。
- `README.md`：说明官方 API Key 与网页 Token 的区别、获取方式、免费额度不保证、CORS 和验收边界。

客户端使用依赖注入的 fetch/sleep/now，测试覆盖请求体、Bearer、GraphQL errors、状态转换、媒体 ID、串行 n、超时、取消和空凭证。

