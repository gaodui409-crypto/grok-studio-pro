import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Settings as SettingsIcon, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { AspectRatioSelect, ResolutionSelect } from "@/components/param-selects";
import { useSettings } from "@/hooks/use-settings";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "设置 — Grok Studio" },
      { name: "description", content: "配置 xAI API Key、代理地址与默认参数。" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { settings, update } = useSettings();
  const [draft, setDraft] = useState(settings);
  const [showKey, setShowKey] = useState(false);

  const save = () => {
    update(draft);
    toast.success("设置已保存");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <PageHeader title="设置" description="API Key 与代理地址保存在浏览器 localStorage，不会上传任何服务器。" icon={SettingsIcon} />

      <div className="space-y-5 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
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
            获取地址：<a href="https://console.x.ai" target="_blank" rel="noreferrer" className="text-primary-glow hover:underline">console.x.ai</a>
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
          <p className="text-xs text-muted-foreground">默认 https://api.x.ai，可改为自托管代理。请求路径会自动拼接 /v1/...</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <AspectRatioSelect value={draft.defaultAspectRatio} onChange={(v) => setDraft({ ...draft, defaultAspectRatio: v })} />
          <ResolutionSelect value={draft.defaultResolution} onChange={(v) => setDraft({ ...draft, defaultResolution: v as "1k" | "2k" })} />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={save} className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95">
            <Save className="mr-2 h-4 w-4" /> 保存设置
          </Button>
        </div>
      </div>
    </div>
  );
}
