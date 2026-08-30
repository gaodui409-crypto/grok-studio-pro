// Provider + model pickers for the generation pages.
//
// These live next to the other generation parameters so that switching channel
// or model does not require a trip to the settings page. Both write straight
// back to settings, because that is where every provider adapter reads from
// (loadSettings() at request time) — keeping the choice in page state instead
// would leave the adapters using the old value.

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettings } from "@/hooks/use-settings";
import {
  enabledProviders,
  IMAGE_MODELS,
  PROVIDERS,
  PROVIDER_MODEL_FIELD,
  type ProviderId,
} from "@/lib/settings";
import {
  availableModels,
  refreshProviderModels,
  supportsModelListing,
} from "@/lib/provider-models";
import type { ModelSpec } from "@/lib/provider-catalog";

function modelOptions(provider: ProviderId): ModelSpec[] {
  // xAI's models are priced presets rather than a fetchable catalog. The rate is
  // folded back into the label here — this select is full-width in settings, where
  // picking a model *is* picking a price, unlike the narrow params rail that made
  // splitting the two necessary in the first place.
  if (provider === "xai") {
    return IMAGE_MODELS.map((m) => ({ id: m.id, label: `${m.label}（${m.rates}）` }));
  }
  return availableModels(provider);
}

export function ProviderSelect() {
  const { settings, update } = useSettings();
  const ready = enabledProviders(settings);

  // Always include the current provider even if unconfigured, so the control
  // never shows an empty value and the user can see what is selected.
  const listed = ready.includes(settings.provider) ? ready : [settings.provider, ...ready];

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        生成渠道
      </Label>
      <Select
        value={settings.provider}
        onValueChange={(value) => update({ ...settings, provider: value as ProviderId })}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {listed.map((id) => {
            const meta = PROVIDERS.find((provider) => provider.id === id);
            const blocked = !ready.includes(id);
            return (
              <SelectItem key={id} value={id}>
                {meta?.label ?? id}
                {blocked ? "（未配置）" : ""}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {ready.length === 0 && (
        <p className="text-xs text-warning">还没有配置好的渠道，请先到设置页填入凭证。</p>
      )}
    </div>
  );
}

export function ProviderModelSelect() {
  const { settings, update } = useSettings();
  const provider = settings.provider;
  const field = PROVIDER_MODEL_FIELD[provider];
  const [models, setModels] = useState<ModelSpec[]>(() => modelOptions(provider));
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setModels(modelOptions(provider));
  }, [provider]);

  // pixai-pool has no model choice at all.
  if (!field) return null;

  const current = String(settings[field] ?? "");
  const canFetch = supportsModelListing(provider);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await refreshProviderModels(provider);
      setModels(next);
      toast.success(`已获取 ${next.length} 个模型`);
    } catch (error) {
      toast.error(`模型列表获取失败：${(error as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  };

  // A free-text model saved earlier (or typed in settings) may not be in the
  // list; show it rather than silently rendering a blank select.
  const options =
    models.some((model) => model.id === current) || !current
      ? models
      : [{ id: current, label: current }, ...models];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          模型
        </Label>
        {canFetch && (
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="获取模型列表"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            获取
          </button>
        )}
      </div>
      {options.length === 0 ? (
        <p className="rounded-md border border-border/60 bg-surface px-2.5 py-1.5 text-xs text-muted-foreground">
          {canFetch ? "点击「获取」拉取可用模型。" : "该渠道使用固定模型，无需选择。"}
        </p>
      ) : (
        <Select value={current} onValueChange={(value) => update({ ...settings, [field]: value })}>
          <SelectTrigger>
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            {options.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {provider === "aihorde" && (
        <p className="text-xs text-muted-foreground">
          留空表示任意可用算力节点。新号 Kudos 为 0 时请选 512 或 768 分辨率。
        </p>
      )}
    </div>
  );
}
