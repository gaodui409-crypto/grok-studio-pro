# PixAI 官方 API Provider 实施计划

> **目标：** 在现有图片 Provider 体系中加入 PixAI v2 官方文生图渠道，同时保留网页号池的协议阻断边界。

## 文件范围

- 新增 `src/lib/pixai-client.ts`：PixAI v2 创建、轮询和结果归一化。
- 新增 `src/lib/pixai-client.test.ts`：协议、状态、超时、取消和串行测试。
- 新增 `src/lib/providers/pixai.ts`：设置到客户端的适配器。
- 修改 `src/lib/settings.ts`：Provider ID、目录、能力、默认值和配置检查。
- 修改 `src/lib/providers/index.ts`：注册官方 PixAI 适配器。
- 修改 `src/routes/settings.tsx`：API Key、模型版本 ID 和说明字段。
- 修改 `src/lib/settings.test.ts`、`src/lib/providers/registry.test.ts`：目录与注册表断言。
- 修改 `README.md`：渠道表、配置方式、限制和验证边界。

## 步骤

### 1. 锁定协议行为

- [x] 先写注入 `fetch`、`sleep`、`now` 的失败测试。
- [x] 覆盖创建请求、Bearer 头、模型/比例/尺寸请求体。
- [x] 覆盖等待到完成、`outputs.mediaUrls` 提取、失败终态、无任务 ID、无结果、超时和 AbortSignal。
- [x] 覆盖 `n > 1` 时逐张串行创建并完成，避免额外并发。
- [x] 运行聚焦测试并确认因客户端不存在而按预期失败。

### 2. 实现 PixAI 客户端与适配器

- [x] 实现统一错误处理和十分钟有界轮询。
- [x] 实现官方 API 适配器，空 Key 在网络前拒绝，默认 Tsubaki.2。
- [x] 运行客户端和适配器测试，确认全部通过。

### 3. 接入设置与注册表

- [x] 增加 `pixai` Provider ID、目录项、能力项和持久化默认值。
- [x] 注册 `pixaiImageProvider`，不改变 `pixai-pool` 的阻断行为。
- [x] 更新设置页条件字段和 API Key 提示。
- [x] 更新设置、注册表和运行时测试。

### 4. 更新用户文档

- [x] 在 README 渠道表和使用说明中说明 PixAI API Key、模型版本 ID、文生图限制和 CORS 要求。
- [x] 明确 `pixai-pool` 仍需 HAR/Network 证据，不能用官方 API Key 代替。

### 5. 验证与交付

- [x] 运行完整单元测试、TypeScript、ESLint、Prettier 检查和生产构建。
- [x] 运行 `git diff --check`，确认无未授权文件变化。
- [x] 保留用户未跟踪的 `1.3 GSP 总控笔记.md`，只提交本任务文件。
- [x] 在交付说明中标注协议/Mock 已验证，真实 PixAI 生成因缺少 API Key 尚未验收。
