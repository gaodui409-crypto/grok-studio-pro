import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SecretInput } from "@/components/secret-input";
import { VideoModelSelect } from "@/components/param-selects";
import {
  PIXAI_MODEL_PRESETS,
  PIXAI_WEB_MODEL_PRESETS,
  type ProviderId,
  type Settings,
} from "@/lib/settings";

type PanelProps = {
  draft: Settings;
  patch: (patch: Partial<Settings>) => void;
};

/**
 * Label, control, then hint — one column.
 *
 * This was label-and-hint on the left with the control on the right, which is
 * where the page's crowding came from: a 15rem label column next to the 208px
 * rail left the hint about 20 characters wide, so Gitee's two-sentence hint
 * broke into five ragged lines and the panel read as a wall. Below a
 * full-width input the same text is two lines.
 *
 * The hint sits under the control rather than above it because it explains where
 * to *get* the value; you read it when the empty box has already raised the
 * question. Credentials are also long opaque strings, so they want the width.
 */
function Field({
  label,
  children,
  hint,
}: {
  label?: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      {label && <Label>{label}</Label>}
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
      <p className="text-foreground/90">{children}</p>
    </div>
  );
}
function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="text-primary-glow hover:underline">
      {children}
    </a>
  );
}

/** Preset chips under an ID field, for channels whose model IDs are opaque digits. */
function PresetChips({
  presets,
  onPick,
}: {
  presets: readonly { id: string; label: string }[];
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 pt-1.5">
      {presets.map((model) => (
        <button
          key={model.id}
          type="button"
          onClick={() => onPick(model.id)}
          className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs hover:border-primary/60"
        >
          {model.label}
        </button>
      ))}
    </div>
  );
}

function XaiPanel({ draft, patch }: PanelProps) {
  return (
    <>
      <Field
        label="xAI API Key"
        hint={
          <>
            官方：<ExternalLink href="https://console.x.ai">console.x.ai</ExternalLink>
            ；也可填入 NewAPI 中转 Key。
          </>
        }
      >
        <SecretInput
          value={draft.apiKey}
          onChange={(apiKey) => patch({ apiKey })}
          placeholder="xai-..."
          label="xAI API Key"
        />
      </Field>
      <Field
        label="API 代理地址"
        hint="默认 https://api.x.ai，可改为 NewAPI 等中转地址。请求路径会自动拼接 /v1/..."
      >
        <Input
          value={draft.baseUrl}
          onChange={(e) => patch({ baseUrl: e.target.value })}
          placeholder="https://api.x.ai"
          aria-label="API 代理地址"
          className="font-mono"
        />
      </Field>
      {/* No Field label: VideoModelSelect renders its own, and wrapping it
          printed 视频模型 twice. */}
      <Field hint="视频生成只有这个渠道支持，其他渠道仅文生图。">
        <VideoModelSelect
          value={draft.videoModel}
          onChange={(videoModel) => patch({ videoModel })}
        />
      </Field>
    </>
  );
}
function GiteePanel({ draft, patch }: PanelProps) {
  return (
    <Field
      label="Gitee AI API Key"
      hint={
        <>
          获取地址：<ExternalLink href="https://ai.gitee.com">ai.gitee.com</ExternalLink>
          。注册需绑定 +86 手机号；注册后会自动创建「免费体验访问令牌」，在任意模型页面的 「在线体验
          → API」里可以取到。
        </>
      }
    >
      <SecretInput
        value={draft.giteeApiKey}
        onChange={(giteeApiKey) => patch({ giteeApiKey })}
        placeholder="免费体验访问令牌"
        label="Gitee AI API Key"
      />
    </Field>
  );
}

function ModelScopePanel({ draft, patch }: PanelProps) {
  return (
    <Field
      label="ModelScope Token"
      hint={
        <>
          获取地址：
          <ExternalLink href="https://modelscope.cn/my/myaccesstoken">modelscope.cn</ExternalLink>
          。浏览器直连会被 CORS 拦住（异步协议要用的 X-ModelScope-Async-Mode
          不在允许头名单里），本地开发环境下才能正常工作。
        </>
      }
    >
      <SecretInput
        value={draft.modelscopeToken}
        onChange={(modelscopeToken) => patch({ modelscopeToken })}
        placeholder="ms-..."
        label="ModelScope Token"
      />
    </Field>
  );
}

function AiHordePanel({ draft, patch }: PanelProps) {
  return (
    <Field
      label="AI Horde API Key（可选）"
      hint="留空使用匿名队列；个人 Key 可提高优先级。社区算力的等待时间和可用模型会变动。"
    >
      <SecretInput
        value={draft.aiHordeApiKey}
        onChange={(aiHordeApiKey) => patch({ aiHordeApiKey })}
        placeholder="留空则使用匿名 Key 0000000000"
        label="AI Horde API Key"
      />
    </Field>
  );
}

function PollinationsPanel({ draft, patch }: PanelProps) {
  return (
    <>
      <Field
        label="Pollinations API Key"
        hint="仅支持 GitHub 登录注册。免费额度不再每日刷新，只能做 Quest 任务赚取。"
      >
        <SecretInput
          value={draft.pollinationsApiKey}
          onChange={(pollinationsApiKey) => patch({ pollinationsApiKey })}
          placeholder="pk_..."
          label="Pollinations API Key"
        />
      </Field>
      <Warning>
        flux 不支持中文提示词，请改用英文。有内容审查，NSFW 会被拒绝。匿名请求会忽略 model
        参数并返回占位图，因此模型列表只在配置 Key 后才可信。
      </Warning>
    </>
  );
}
function PixaiPanel({ draft, patch }: PanelProps) {
  return (
    <>
      <Field
        label="PixAI API Key"
        hint="普通用户需申请并等待审核，会员可直接获取；公开免费额度未知。请求直接发送到 api.pixai.art，不使用网页登录 Token。Key 只保存在当前浏览器。"
      >
        <SecretInput
          value={draft.pixaiApiKey}
          onChange={(pixaiApiKey) => patch({ pixaiApiKey })}
          placeholder="PixAI v2 API Key"
          label="PixAI API Key"
        />
      </Field>
      <Field
        label="PixAI 模型版本 ID"
        hint="默认 Tsubaki.2。通用 2k 档会按 PixAI 协议转换为 1.5k；多张图片逐张提交。PixAI 不支持 2:1、1:2 和 auto 比例。"
      >
        <Input
          value={draft.pixaiModelVersionId}
          onChange={(e) => patch({ pixaiModelVersionId: e.target.value })}
          placeholder="1983308862240288769"
          aria-label="PixAI 模型版本 ID"
          className="font-mono"
        />
        <PresetChips
          presets={PIXAI_MODEL_PRESETS}
          onPick={(pixaiModelVersionId) => patch({ pixaiModelVersionId })}
        />
      </Field>
    </>
  );
}

function PixaiWebPanel({ draft, patch }: PanelProps) {
  return (
    <>
      <Field
        label="PixAI 网页 Token（生成前必填）"
        hint="登录 pixai.art 后按 F12 → Application → Cookies → .pixai.art → user_token 复制 value。它是敏感登录凭证，有效期约一周，仅保存在当前浏览器 localStorage；本项目不会自动读取或登录。"
      >
        <SecretInput
          value={draft.pixaiWebToken}
          onChange={(pixaiWebToken) => patch({ pixaiWebToken })}
          placeholder="user_token 的 value"
          label="PixAI 网页 Token"
        />
      </Field>
      <Field
        label="PixAI 网页模型 ID（生成前必填）"
        hint="从网页生图时 DevTools Network 的 createGenerationTask 请求体里取 modelId。"
      >
        <Input
          value={draft.pixaiWebModelId}
          onChange={(e) => patch({ pixaiWebModelId: e.target.value })}
          placeholder="当前网页 GraphQL 使用的 modelId"
          aria-label="PixAI 网页模型 ID"
          className="font-mono"
        />
        <PresetChips
          presets={PIXAI_WEB_MODEL_PRESETS}
          onPick={(pixaiWebModelId) => patch({ pixaiWebModelId })}
        />
      </Field>
      <Warning>
        上面那个预设标着「待验证」是有原因的：实测笔记记录 Haruka v2 的网页 modelId 与官方 API 的
        modelVersionId 是同一串数字，但网页 GraphQL 和官方 REST 向来是两套独立的 ID
        空间，两种说法只有一个成立。先按预设试，失败就从 createGenerationTask 请求体里取真实
        modelId。 此渠道仅支持文生图，NSFW 需先在 PixAI 账号里验证邮箱并开启相关选项。画面比例为
        auto 时会在发包前被拒绝。
      </Warning>
    </>
  );
}

function PixaiPoolPanel({ draft, patch }: PanelProps) {
  return (
    <>
      <Field label="PixAI 号池网址">
        <Input
          value={draft.pixaiPoolBaseUrl}
          onChange={(e) => patch({ pixaiPoolBaseUrl: e.target.value })}
          placeholder="https://imgapi.qianyimwl.top"
          aria-label="PixAI 号池网址"
          className="font-mono"
        />
      </Field>
      <Warning>
        当前只有网页和模型列表，没有提交、轮询、结果的真实请求协议。提供一次生成的 HAR 或 DevTools
        Network 请求/响应后即可完成传输接入；此前不会向该网址猜测发包。
      </Warning>
    </>
  );
}

const PANELS: Record<ProviderId, (props: PanelProps) => React.ReactNode> = {
  xai: XaiPanel,
  gitee: GiteePanel,
  modelscope: ModelScopePanel,
  aihorde: AiHordePanel,
  pollinations: PollinationsPanel,
  pixai: PixaiPanel,
  "pixai-web": PixaiWebPanel,
  "pixai-pool": PixaiPoolPanel,
};

/**
 * The credential fields for one channel.
 *
 * Exported as a single component that dispatches internally, rather than eight
 * exports plus a lookup table, so this module has exactly one public component.
 */
export function ProviderPanel({ provider, draft, patch }: PanelProps & { provider: ProviderId }) {
  const Panel = PANELS[provider];
  return <div className="space-y-6">{Panel ? <Panel draft={draft} patch={patch} /> : null}</div>;
}
