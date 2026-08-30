import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Save, RotateCcw, CheckCircle2, Sliders, Users, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ProviderPanel } from "@/components/settings/provider-panels";
import { GeneralPanel } from "@/components/settings/general-panel";
import { PresetManager } from "@/components/settings/preset-manager";
import { useSettings } from "@/hooks/use-settings";
import { providerSetupIssue, type ProviderId, type Settings } from "@/lib/settings";
import { providerMeta, splitProviderLabel } from "@/lib/provider-status";
import { useAppStore } from "@/lib/app-store";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "设置 — Grok Studio" },
      { name: "description", content: "配置图片生成渠道、凭证、并发与默认参数。" },
    ],
  }),
  component: SettingsPage,
});

function SectionHeading({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Sliders;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 space-y-1">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <Icon className="h-4 w-4 text-primary-glow" aria-hidden /> {title}
      </h2>
      {children && <p className="text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

function SettingsPage() {
  const { settings, update, ready } = useSettings();
  const applySettingsDefaults = useAppStore((state) => state.applySettingsDefaults);
  const [draft, setDraft] = useState(settings);
  // Which channel's config is open. Separate from draft.provider (the channel
  // used for generation) so that browsing another channel's settings does not
  // silently switch what the generate button will use.
  const [selected, setSelected] = useState<ProviderId>(settings.provider);
  const landed = useRef(false);
  const generalRef = useRef<HTMLDivElement>(null);
  const presetsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  // Open on the channel actually in use. The first render happens before
  // localStorage is read (see useSettings), so the initial useState above can
  // only ever see the default provider — without this, a user whose channel is
  // Gitee would land on xAI's panel.
  //
  // Guarded to fire once: `settings` also changes on save, and re-running then
  // would yank you out of the channel you were configuring. The guard is also
  // set by selectChannel below, so a click that lands in the gap between
  // hydration and localStorage arriving is not overwritten a moment later.
  useEffect(() => {
    if (!ready || landed.current) return;
    landed.current = true;
    setSelected(settings.provider);
  }, [ready, settings.provider]);

  const selectChannel = (provider: ProviderId) => {
    landed.current = true;
    setSelected(provider);
  };

  const patch = (next: Partial<Settings>) => setDraft((current) => ({ ...current, ...next }));

  const save = () => {
    update(draft);
    applySettingsDefaults(draft);
    toast.success("设置已保存并应用");
  };

  const jump = (section: "general" | "presets") => {
    const target = section === "general" ? generalRef.current : presetsRef.current;
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Both sides come from the same object shape with the same key order, so
  // stringify is a sound equality check here and stays correct as fields are
  // added. It gates 保存 / 还原 and drives the unsaved-changes hint — which
  // matters more now that 保存 sits in the header instead of under the fields.
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  const meta = providerMeta(selected);
  const label = splitProviderLabel(meta?.label ?? selected);
  const issue = providerSetupIssue(draft, selected);
  const isCurrent = draft.provider === selected;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <SettingsNav draft={draft} selected={selected} onSelect={selectChannel} onJump={jump} />

      <div className="min-w-0 flex-1">
        <div className="sticky top-14 z-20 flex items-center justify-between gap-4 border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">设置</h1>
            <p className="truncate text-xs text-muted-foreground">
              凭证、并发与默认参数保存在浏览器 localStorage。模型选择在各生成页的参数栏。
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {dirty && <span className="text-xs text-warning">有未保存的修改</span>}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDraft(settings)}
              disabled={!dirty}
              aria-label="还原未保存的修改"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" /> 还原
            </Button>
            {/* Not gated on `dirty`: saving also re-applies these defaults to the
                generation pages, so it stays useful after tweaking a value there
                and wanting the saved default back. */}
            <Button
              onClick={save}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-95"
            >
              <Save className="mr-2 h-4 w-4" /> 保存
            </Button>
          </div>
        </div>

        <div className="space-y-8 px-6 py-6">
          {/* Labelled region so the channel pane is addressable on its own. The
              nav's group labels are h2 as well, so "the second-level heading"
              alone does not identify this one. */}
          <section aria-label="渠道配置">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              {label.name} · 配置
            </p>
            <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
                  {label.name}
                </h2>
                {label.tag && (
                  <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary-glow">
                    {label.tag}
                  </span>
                )}
              </div>
              {isCurrent ? (
                <span className="flex items-center gap-1.5 rounded-md border border-success/40 px-2.5 py-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> 当前生成渠道
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => patch({ provider: selected })}
                  disabled={issue !== null}
                  title={issue ? `还需填写：${issue}` : undefined}
                >
                  切换为当前
                </Button>
              )}
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">{meta?.desc}</p>

            <p className="mt-4 flex gap-2 rounded-lg border border-dashed border-border/60 bg-surface/60 px-3 py-2.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                <span className="text-foreground/80">免费额度：</span>
                {meta?.quota}
              </span>
            </p>
            {issue && <p className="mt-2 text-xs text-warning">还需填写：{issue}</p>}

            <div className="mt-6 rounded-2xl border border-border/60 bg-card p-6 shadow-card">
              <ProviderPanel provider={selected} draft={draft} patch={patch} />
            </div>
          </section>

          {/* scroll-mt clears both sticky bars (app header 3.5rem + page header). */}
          <section
            ref={generalRef}
            className="scroll-mt-32 rounded-2xl border border-border/60 bg-card p-6 shadow-card"
          >
            <SectionHeading icon={Sliders} title="通用默认值">
              对所有渠道生效，新建任务时作为初始值。
            </SectionHeading>
            <GeneralPanel draft={draft} patch={patch} />
          </section>

          <section
            ref={presetsRef}
            className="scroll-mt-32 rounded-2xl border border-border/60 bg-card p-6 shadow-card"
          >
            <SectionHeading icon={Users} title="角色预设">
              同人图批量会用到。编辑后立即生效，不需要按上面的保存。
            </SectionHeading>
            <PresetManager />
          </section>
        </div>
      </div>
    </div>
  );
}
