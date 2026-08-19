# PixAI 官方 API Provider 设计

## 背景

项目正在从 xAI 单一工具改造为多渠道图片工作台。现有 `pixai-pool` 仅登记了用户提供的网页号池地址，但没有真实的网页请求协议，不能安全猜测接口。公开代码中同时存在两类 PixAI 调用方式：旧网页 GraphQL Token 和较新的 v2 REST API。旧 GraphQL 项目没有可复用许可证，且依赖网页登录态；本次只采用有 MIT 许可证、协议明确的 v2 REST 参考实现。

## 目标

- 增加独立的 `pixai` 官方 API Provider，支持 PixAI v2 文生图。
- 使用 API Key、模型版本 ID、比例和尺寸等级提交任务。
- 对异步任务执行有界轮询，返回项目统一的 `GeneratedImage[]`。
- 多图请求在 Provider 内串行提交，适配共享账号或受限并发环境。
- 保留 `pixai-pool` 作为待协议渠道，不把官方 API 与网页号池混为一谈。
- 在设置页和 README 中准确说明凭证、模型和真实验收边界。

## 非目标

- 不接入网页 LocalStorage Token、Cookie 或私有 GraphQL 登录流程。
- 不实现批量注册、临时邮箱、验证码绕过、自动薅积分或机器人检测规避。
- 不猜测 `imgapi.qianyimwl.top` 的私有接口，不宣称号池已可用。
- 本次不支持 PixAI 图生图、视频、跨渠道自动回退、账号轮换和额度调度。

## 协议

提交：`POST https://api.pixai.art/v2/image/create`

请求头：

- `Authorization: Bearer <API Key>`
- `Content-Type: application/json`

请求体最小字段：

```json
{
  "modelVersionId": "1983308862240288769",
  "prompt": "...",
  "aspectRatio": "1:1",
  "size": "1k"
}
```

任务查询：`GET https://api.pixai.art/v1/task/{taskId}`，同样携带 Bearer 认证。PixAI 官方当前使用 v2 创建接口和 v1 通用任务查询接口，不能从创建接口的版本推断查询路径。兼容 `waiting`、`pending`、`started`、`processing`、`running`、`completed`、`success`、`failed`、`error`、`cancelled` 和 `canceled` 状态。完成任务从 `outputs.mediaUrls` 提取图片地址。

默认模型为 Tsubaki.2：`1983308862240288769`。已知可选模型：Haruka v2 `1861558740588989558`、Hoshino v2 `1954632828118619567`。模型 ID 作为设置项保存，便于后续替换而不修改代码。PixAI v2 的尺寸枚举为 `1k` 和 `1.5k`，因此项目通用的 `2k` 档在适配器边界映射为 `1.5k`。通用比例中的 `2:1`、`1:2` 和 `auto` 不在 PixAI 官方枚举中，适配器会在网络请求前拒绝并提示选择支持的比例，不进行会改变构图的静默近似转换。

## 架构

`src/lib/pixai-client.ts` 只负责 HTTP、任务状态、轮询、超时和结果归一化，并通过依赖注入接收 `fetch`、`sleep`、时钟和轮询参数。`src/lib/providers/pixai.ts` 从当前设置读取 API Key 和模型 ID，把通用图片参数转换为 PixAI 请求。适配器仍实现现有 `ImageProviderAdapter`，不改变页面调用协议。

`pixai-pool` 继续使用原有显式阻断适配器。两个 Provider 的能力分别登记为：官方 API 仅文生图；号池暂不支持任何生成能力。

## 错误与安全

- API Key 为空时在设置页提示，客户端不会发起网络请求。
- HTTP 错误使用响应 JSON 中的 `message` 或 `error` 作为可读错误。
- 缺少任务 ID、未知终态、失败状态、无图片结果和轮询超时都抛出 PixAI 专属错误。
- 每次提交和轮询都检查 `AbortSignal`；取消不会继续发起后续请求。
- 每个任务使用独立的十分钟 AbortController 截止时间，能够中止仍在等待响应的创建或查询请求；默认轮询间隔三秒，满足官方“不短于 1.5 秒”的要求。
- Key 只保存在浏览器 `localStorage`，README 提醒不要在公共设备保存。

## 验证边界

Mock 和协议级测试验证 URL、Bearer、请求体、状态转换、超时、取消和串行行为。没有真实 PixAI API Key 时不进行真实图片生成验收，也不把 HTTP 端点存在误写成渠道已打通。
