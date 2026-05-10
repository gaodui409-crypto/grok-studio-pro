import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Settings as SettingsIcon, Save, Eye, EyeOff, Plus, Trash2, Pencil, Check, X, Users, Cloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { PageHeader } from "@/components/page-header";
import { AspectRatioSelect, ResolutionSelect, ImageModelSelect, VideoModelSelect } from "@/components/param-selects";
import { useSettings } from "@/hooks/use-settings";
import { PROVIDERS, HF_MODEL_PRESETS, type ProviderId } from "@/lib/settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BUILTIN_PRESETS, loadCustomPresets, saveCustomPresets, newCustomPreset,
  type CharacterPreset,
} from "@/lib/character-presets";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "设置 — Grok Studio" },
      { name: "description", content: "配置 xAI API Key、代理地址、并发与默认参数。" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => { setDraft(settings); }, [settings]);

  const save = () => {
    update(draft);
    toast.success("设置已保存");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <PageHeader title="设置" description="API Key、代理地址、并发与角色预设全部保存在浏览器 localStorage。" icon={SettingsIcon} />

      <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
        <div className="space-y-2">
          <Label className="flex items-center gap-2"><Cloud className="h-4 w-4" /> 图片生成来源</Label>
          <Select value={draft.provider} onValueChange={(v) => setDraft({ ...draft, provider: v as ProviderId })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROVIDERS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {PROVIDERS.find((p) => p.id === draft.provider)?.desc}
          </p>
        </div>

        {draft.provider === "xai" && (
          <>
            <div className="space-y-2">
              <Label>xAI API Key</Label>
              <div className="relative">
                <Input
                  type={showKey ? "text" : "password"}
                  value={draft.apiKey}
                  onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                  placeholder="xai-..."
                  className="pr-10 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                官方：<a href="https://console.x.ai" target="_blank" rel="noreferrer" className="text-primary-glow hover:underline">console.x.ai</a>；也可填入 NewAPI 中转 Key。
              </p>
            </div>

            <div className="space-y-2">
              <Label>API 代理地址</Label>
              <Input
                value={draft.baseUrl}
                onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                placeholder="https://api.x.ai"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">默认 https://api.x.ai，可改为 NewAPI 等中转地址。请求路径会自动拼接 /v1/...</p>
            </div>
          </>
        )}

        {draft.provider === "modelscope" && (
          <div className="space-y-2">
            <Label>ModelScope Token</Label>
            <Input
              type={showKey ? "text" : "password"}
              value={draft.modelscopeToken}
              onChange={(e) => setDraft({ ...draft, modelscopeToken: e.target.value })}
              placeholder="ms-..."
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              获取地址：<a href="https://modelscope.cn/my/myaccesstoken" target="_blank" rel="noreferrer" className="text-primary-glow hover:underline">modelscope.cn</a>。
              固定使用 Tongyi-MAI/Z-Image-Turbo（异步）。免费额度 2000/天，并发 ≤3。
            </p>
          </div>
        )}

        {draft.provider === "hf" && (
          <>
            <div className="space-y-2">
              <Label>Hugging Face Token</Label>
              <Input
                type={showKey ? "text" : "password"}
                value={draft.hfToken}
                onChange={(e) => setDraft({ ...draft, hfToken: e.target.value })}
                placeholder="hf_..."
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                获取地址：<a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-primary-glow hover:underline">huggingface.co/settings/tokens</a>。免费用户约 80 次/天。
              </p>
            </div>
            <div className="space-y-2">
              <Label>HF 模型</Label>
              <Input
                value={draft.hfModel}
                onChange={(e) => setDraft({ ...draft, hfModel: e.target.value })}
                placeholder="Tongyi-MAI/Z-Image-Turbo"
                className="font-mono"
              />
              <div className="flex flex-wrap gap-1.5">
                {HF_MODEL_PRESETS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setDraft({ ...draft, hfModel: m })}
                    className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs hover:border-primary/60"
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>并发请求数</Label>
            <span className="font-mono text-primary-glow">{draft.concurrency}</span>
          </div>
          <Slider
            min={1} max={10} step={1}
            value={[draft.concurrency]}
            onValueChange={(v) => setDraft({ ...draft, concurrency: v[0] })}
          />
          <p className="text-xs text-muted-foreground">
            同人图批量、漫画上色、漫画翻译均使用此并发数。xAI 限频：图片 30 RPM、视频 60 RPM；ModelScope 建议 ≤3。
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AspectRatioSelect value={draft.defaultAspectRatio} onChange={(v) => setDraft({ ...draft, defaultAspectRatio: v })} />
          <ResolutionSelect value={draft.defaultResolution} onChange={(v) => setDraft({ ...draft, defaultResolution: v as "1k" | "2k" })} />
          {draft.provider === "xai" && <ImageModelSelect value={draft.imageModel} onChange={(v) => setDraft({ ...draft, imageModel: v })} />}
          {draft.provider === "xai" && <VideoModelSelect value={draft.videoModel} onChange={(v) => setDraft({ ...draft, videoModel: v })} />}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
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
    setDraft({ ...p, scenes: p.scenes.map((s) => ({ ...s, outfits: [...s.outfits], actions: [...s.actions] })) });
    setEditingId(p.id);
  };

  const cancelEdit = () => { setEditingId(null); setDraft(null); };

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
    setDraft({ ...draft, scenes: draft.scenes.map((s, i) => (i === idx ? { ...s, ...patch } : s)) });
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
            <span key={p.id} className="rounded-full border border-border/60 bg-surface px-2.5 py-1 text-xs">
              ★ {p.name}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">自定义预设 ({list.length})</p>
        {list.length === 0 && !editingId && (
          <p className="rounded-lg border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
            暂无自定义预设。点击「新建预设」添加你自己的角色。
          </p>
        )}
        <div className="space-y-2">
          {list.map((p) => (
            editingId === p.id && draft ? (
              <PresetEditor key={p.id} draft={draft} setDraft={setDraft} onCancel={cancelEdit} onCommit={commitEdit} updateScene={updateScene} />
            ) : (
              <div key={p.id} className="flex items-start justify-between gap-2 rounded-lg border border-border/60 bg-surface/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{p.name}</div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{p.scenes.length} 个场景配置</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(p.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )
          ))}
          {editingId && draft && !list.some((p) => p.id === draft.id) && (
            <PresetEditor draft={draft} setDraft={setDraft} onCancel={cancelEdit} onCommit={commitEdit} updateScene={updateScene} />
          )}
        </div>
      </div>
    </div>
  );
}

function PresetEditor({
  draft, setDraft, onCancel, onCommit, updateScene,
}: {
  draft: CharacterPreset;
  setDraft: (p: CharacterPreset) => void;
  onCancel: () => void;
  onCommit: () => void;
  updateScene: (idx: number, patch: Partial<CharacterPreset["scenes"][number]>) => void;
}) {
  const addScene = () =>
    setDraft({ ...draft, scenes: [...draft.scenes, { sceneName: "新场景", outfits: [], actions: [] }] });
  const removeScene = (i: number) =>
    setDraft({ ...draft, scenes: draft.scenes.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-3 rounded-lg border border-primary/40 bg-surface/60 p-3">
      <div className="grid gap-2 md:grid-cols-2">
        <div>
          <Label className="text-xs">名称</Label>
          <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">默认画风</Label>
          <Input value={draft.defaultStyle ?? ""} onChange={(e) => setDraft({ ...draft, defaultStyle: e.target.value })} className="h-8 text-sm" placeholder="动漫赛璐璐" />
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
        <Input value={draft.defaultLighting ?? ""} onChange={(e) => setDraft({ ...draft, defaultLighting: e.target.value })} className="h-8 text-sm" placeholder="柔和晨光" />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">场景配置（场景名匹配场景树中的场景）</Label>
          <Button size="sm" variant="ghost" onClick={addScene}><Plus className="h-3.5 w-3.5" /> 添加</Button>
        </div>
        {draft.scenes.map((s, i) => (
          <div key={i} className="space-y-1.5 rounded border border-border/60 bg-background/60 p-2 text-xs">
            <div className="flex items-center gap-2">
              <Input value={s.sceneName} onChange={(e) => updateScene(i, { sceneName: e.target.value })} className="h-7 w-32 text-xs" placeholder="场景名" />
              <Button size="icon" variant="ghost" className="ml-auto h-6 w-6 text-destructive" onClick={() => removeScene(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <Textarea
              value={s.outfits.join("\n")}
              onChange={(e) => updateScene(i, { outfits: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
              className="min-h-[60px] resize-none text-xs"
              placeholder="服装（每行一个）"
            />
            <Textarea
              value={s.actions.join("\n")}
              onChange={(e) => updateScene(i, { actions: e.target.value.split("\n").map((x) => x.trim()).filter(Boolean) })}
              className="min-h-[60px] resize-none text-xs"
              placeholder="动作（每行一个）"
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}><X className="mr-1 h-3.5 w-3.5" /> 取消</Button>
        <Button size="sm" onClick={onCommit}><Check className="mr-1 h-3.5 w-3.5" /> 保存</Button>
      </div>
    </div>
  );
}
