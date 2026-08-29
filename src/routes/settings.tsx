import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Settings as SettingsIcon,
  Save,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Users,
  AlertTriangle,
  CheckCircle2,
  Sliders,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { SecretInput } from "@/components/secret-input";
import { AspectRatioSelect, ResolutionSelect, VideoModelSelect } from "@/components/param-selects";
import { useSettings } from "@/hooks/use-settings";
import {
  PROVIDERS,
  PIXAI_MODEL_PRESETS,
  PIXAI_WEB_MODEL_PRESETS,
  providerSetupIssue,
  type ProviderId,
  type ResolutionTier,
  type Settings,
} from "@/lib/settings";
import {
  BUILTIN_PRESETS,
  loadCustomPresets,
  saveCustomPresets,
  newCustomPreset,
  type CharacterPreset,
} from "@/lib/character-presets";
import { useAppStore } from "@/lib/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "设置 — Grok Studio" },
      { name: "description", content: "配置图片生成渠道、凭证、并发与默认参数。" },
    ],
  }),
  component: SettingsPage,
});

type PanelProps = {
  draft: Settings;
  patch: (patch: Partial<Settings>) => void;
};

/** Small helper so every field block looks the same. */
function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
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
          className="font-mono"
        />
      </Field>
      <Field label="视频模型">
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
          className="font-mono"
        />
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          {PIXAI_MODEL_PRESETS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => patch({ pixaiModelVersionId: model.id })}
              className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs hover:border-primary/60"
            >
              {model.label}
            </button>
          ))}
        </div>
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
          className="font-mono"
        />
        <div className="flex flex-wrap gap-1.5 pt-1.5">
          {PIXAI_WEB_MODEL_PRESETS.map((model) => (
            <button
              key={model.id}
              type="button"
              onClick={() => patch({ pixaiWebModelId: model.id })}
              className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs hover:border-primary/60"
            >
              {model.label}
            </button>
          ))}
        </div>
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

const PROVIDER_PANELS: Record<ProviderId, (props: PanelProps) => React.ReactNode> = {
  xai: XaiPanel,
  gitee: GiteePanel,
  modelscope: ModelScopePanel,
  aihorde: AiHordePanel,
  pollinations: PollinationsPanel,
  pixai: PixaiPanel,
  "pixai-web": PixaiWebPanel,
  "pixai-pool": PixaiPoolPanel,
};

function SettingsPage() {
  const { settings, update } = useSettings();
  const applySettingsDefaults = useAppStore((state) => state.applySettingsDefaults);
  const [draft, setDraft] = useState(settings);
  // Which provider's page is open. Separate from draft.provider (the channel
  // used for generation) so that browsing another channel's settings does not
  // silently switch what the generate button will use.
  const [tab, setTab] = useState<ProviderId>(settings.provider);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const patch = (next: Partial<Settings>) => setDraft((current) => ({ ...current, ...next }));

  const save = () => {
    update(draft);
    applySettingsDefaults(draft);
    toast.success("设置已保存并应用");
  };

  const meta = PROVIDERS.find((provider) => provider.id === tab);
  const Panel = PROVIDER_PANELS[tab];
  const issue = providerSetupIssue(draft, tab);
  const isActive = draft.provider === tab;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <PageHeader
        title="设置"
        description="API Key、代理地址、并发与角色预设全部保存在浏览器 localStorage。模型选择已移到各生成页的参数栏。"
        icon={SettingsIcon}
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as ProviderId)}>
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
          {PROVIDERS.map((provider) => {
            const ready = providerSetupIssue(draft, provider.id) === null;
            return (
              <TabsTrigger
                key={provider.id}
                value={provider.id}
                className="rounded-full border border-border/60 bg-surface data-[state=active]:border-primary/60 data-[state=active]:bg-card"
              >
                <span
                  className={cn(
                    "mr-1.5 inline-block h-1.5 w-1.5 rounded-full",
                    ready ? "bg-success" : "bg-muted-foreground/40",
                  )}
                  aria-hidden
                />
                {provider.label.replace(/（.*）/, "")}
                {draft.provider === provider.id && " ·"}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {PROVIDERS.map((provider) => (
          <TabsContent key={provider.id} value={provider.id} className="mt-4">
            <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base font-semibold">{meta?.label}</h3>
                  {isActive ? (
                    <span className="flex items-center gap-1 text-xs text-success">
                      <CheckCircle2 className="h-3.5 w-3.5" /> 当前生成渠道
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => patch({ provider: tab })}
                      disabled={issue !== null}
                    >
                      设为当前渠道
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{meta?.desc}</p>
                <p className="rounded-lg border border-dashed border-border/60 bg-surface/60 px-3 py-2 text-xs text-muted-foreground">
                  <span className="text-foreground/80">免费额度：</span>
                  {meta?.quota}
                </p>
                {issue && <p className="text-xs text-warning">还需填写：{issue}</p>}
              </div>

              {Panel && <Panel draft={draft} patch={patch} />}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      <div className="mt-6 space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <Sliders className="h-4 w-4" /> 通用默认值
        </h3>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>并发请求数</Label>
            <span className="font-mono text-primary-glow">{draft.concurrency}</span>
          </div>
          <Slider
            min={1}
            max={10}
            step={1}
            value={[draft.concurrency]}
            onValueChange={(v) => patch({ concurrency: v[0] })}
          />
          <p className="text-xs text-muted-foreground">
            同人图批量、漫画上色、漫画翻译均使用此并发数。共享免费渠道或同时运行其他会话时建议设为
            1。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AspectRatioSelect
            value={draft.defaultAspectRatio}
            onChange={(defaultAspectRatio) => patch({ defaultAspectRatio })}
          />
          <ResolutionSelect
            value={draft.defaultResolution}
            onChange={(value) => patch({ defaultResolution: value as ResolutionTier })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          低分辨率档位是为免费渠道准备的：AI Horde 新号 Kudos 为 0 时只能出约 711×711 以下，选 512
          或 768 才不会被拒。各模型还有自己的上限（如 Z-Image-Turbo 1664），超出会自动收敛。
        </p>

        <div className="flex justify-end pt-2">
          <Button
            onClick={save}
            className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
          >
            <Save className="mr-2 h-4 w-4" /> 保存设置
          </Button>
        </div>
      </div>

      <PresetManager />
    </div>
  );
}

function PresetManager() {
  const [list, setList] = useState<CharacterPreset[]>(loadCustomPresets);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CharacterPreset | null>(null);

  const persist = (next: CharacterPreset[]) => {
    setList(next);
    saveCustomPresets(next);
  };

  const startNew = () => {
    const p = newCustomPreset();
    setDraft(p);
    setEditingId(p.id);
  };

  const startEdit = (p: CharacterPreset) => {
    setDraft({
      ...p,
      scenes: p.scenes.map((s) => ({ ...s, outfits: [...s.outfits], actions: [...s.actions] })),
    });
    setEditingId(p.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const commitEdit = () => {
    if (!draft) return;
    const exists = list.some((p) => p.id === draft.id);
    persist(exists ? list.map((p) => (p.id === draft.id ? draft : p)) : [...list, draft]);
    cancelEdit();
    toast.success("预设已保存");
  };

  const remove = (id: string) => {
    if (!confirm("删除此自定义预设？")) return;
    persist(list.filter((p) => p.id !== id));
  };

  const updateScene = (idx: number, patch: Partial<CharacterPreset["scenes"][number]>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      scenes: draft.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    });
  };

  return (
    <div className="mt-6 space-y-4 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-display text-base font-semibold">
          <Users className="h-4 w-4" /> 角色预设管理
        </h3>
        <Button size="sm" variant="secondary" onClick={startNew} disabled={!!editingId}>
          <Plus className="mr-1 h-4 w-4" /> 新建预设
        </Button>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">内置预设（只读）</p>
        <div className="flex flex-wrap gap-1.5">
          {BUILTIN_PRESETS.map((p) => (
            <span
              key={p.id}
              className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs"
            >
              ★ {p.name}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          自定义预设 ({list.length})
        </p>
        {list.length === 0 && !editingId && (
          <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            暂无自定义预设。点击「新建预设」添加你自己的角色。
          </p>
        )}
        <div className="space-y-2">
          {list.map((p) =>
            editingId === p.id && draft ? (
              <PresetEditor
                key={p.id}
                draft={draft}
                setDraft={setDraft}
                onCancel={cancelEdit}
                onCommit={commitEdit}
                updateScene={updateScene}
              />
            ) : (
              <div
                key={p.id}
                className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-surface/40 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {p.scenes.length} 个场景配置
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => startEdit(p)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => remove(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ),
          )}
          {editingId && draft && !list.some((p) => p.id === draft.id) && (
            <PresetEditor
              draft={draft}
              setDraft={setDraft}
              onCancel={cancelEdit}
              onCommit={commitEdit}
              updateScene={updateScene}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function PresetEditor({
  draft,
  setDraft,
  onCancel,
  onCommit,
  updateScene,
}: {
  draft: CharacterPreset;
  setDraft: (p: CharacterPreset) => void;
  onCancel: () => void;
  onCommit: () => void;
  updateScene: (idx: number, patch: Partial<CharacterPreset["scenes"][number]>) => void;
}) {
  const addScene = () =>
    setDraft({
      ...draft,
      scenes: [...draft.scenes, { sceneName: "新场景", outfits: [], actions: [] }],
    });
  const removeScene = (i: number) =>
    setDraft({ ...draft, scenes: draft.scenes.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-surface/60 p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label className="text-xs">名称</Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">默认画风</Label>
          <Input
            value={draft.defaultStyle ?? ""}
            onChange={(e) => setDraft({ ...draft, defaultStyle: e.target.value })}
            className="h-8 text-sm"
            placeholder="动漫赛璐璐"
          />
        </div>
      </div>
      <div>
        <Label className="text-xs">角色描述（提示词主体）</Label>
        <Textarea
          value={draft.description}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          className="min-h-[80px] resize-none text-sm"
        />
      </div>
      <div>
        <Label className="text-xs">默认光影</Label>
        <Input
          value={draft.defaultLighting ?? ""}
          onChange={(e) => setDraft({ ...draft, defaultLighting: e.target.value })}
          className="h-8 text-sm"
          placeholder="柔和晨光"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">场景配置（场景名匹配场景树中的场景）</Label>
          <Button size="sm" variant="ghost" onClick={addScene}>
            <Plus className="h-3.5 w-3.5" /> 添加
          </Button>
        </div>
        {draft.scenes.map((s, i) => (
          <div
            key={i}
            className="space-y-1.5 rounded border border-border/60 bg-background/60 p-2 text-xs"
          >
            <div className="flex items-center gap-2">
              <Input
                value={s.sceneName}
                onChange={(e) => updateScene(i, { sceneName: e.target.value })}
                className="h-7 w-32 text-xs"
                placeholder="场景名"
              />
              <Button
                size="icon"
                variant="ghost"
                className="ml-auto h-6 w-6 text-destructive"
                onClick={() => removeScene(i)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              value={s.outfits.join("\n")}
              onChange={(e) =>
                updateScene(i, {
                  outfits: e.target.value
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-[60px] resize-none text-xs"
              placeholder="服装（每行一个）"
            />
            <Textarea
              value={s.actions.join("\n")}
              onChange={(e) =>
                updateScene(i, {
                  actions: e.target.value
                    .split("\n")
                    .map((x) => x.trim())
                    .filter(Boolean),
                })
              }
              className="min-h-[60px] resize-none text-xs"
              placeholder="动作（每行一个）"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="mr-1 h-3.5 w-3.5" /> 取消
        </Button>
        <Button size="sm" onClick={onCommit}>
          <Check className="mr-1 h-3.5 w-3.5" /> 保存
        </Button>
      </div>
    </div>
  );
}
