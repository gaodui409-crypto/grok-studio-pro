import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Save, RotateCcw, CheckCircle2, Info } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SettingsNav, type SettingsView } from "@/components/settings/settings-nav";
import { ProviderPanel } from "@/components/settings/provider-panels";
import { ConcurrencyPanel, ImageDefaultsPanel } from "@/components/settings/general-panel";
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

/** One titled card. The main column is a stack of these in every view. */
function Card({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card p-5 shadow-card md:p-6">
      {title && (
        <div className="mb-4 space-y-1">
          <h3 className="font-display text-sm font-semibold">{title}</h3>
          {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/** Eyebrow, title, and optional trailing control, shared by all three views. */
function PaneHeader({
  eyebrow,
  title,
  tag,
  desc,
  action,
}: {
  eyebrow: string;
  title: string;
  tag?: string | null;
  desc?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">{title}</h2>
          {tag && (
            <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs text-primary-glow">
              {tag}
            </span>
          )}
        </div>
        {action}
      </div>
      {desc && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{desc}</p>}
    </div>
  );
}

function SettingsPage() {
  const { settings, update, ready } = useSettings();
  const applySettingsDefaults = useAppStore((state) => state.applySettingsDefaults);
  const [draft, setDraft] = useState(settings);
  // Which pane is open. Independent of draft.provider (the channel used for
  // generation) so that reading another channel's settings does not silently
  // switch what the generate button will use.
  const [view, setView] = useState<SettingsView>({ kind: "channel", provider: settings.provider });
  const landed = useRef(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  // Open on the channel actually in use. The first render happens before
  // localStorage is read (see useSettings), so the initial useState above can
  // only ever see the default provider — without this, a user whose channel is
  // Gitee would land on xAI's panel.
  //
  // Guarded to fire once: `settings` also changes on save, and re-running then
  // would yank you out of the pane you were working in. The guard is also set by
  // selectView below, so a click that lands in the gap between hydration and
  // localStorage arriving is not overwritten a moment later.
  useEffect(() => {
    if (!ready || landed.current) return;
    landed.current = true;
    setView({ kind: "channel", provider: settings.provider });
  }, [ready, settings.provider]);

  const selectView = (next: SettingsView) => {
    landed.current = true;
    setView(next);
  };

  const patch = (next: Partial<Settings>) => setDraft((current) => ({ ...current, ...next }));

  const save = () => {
    update(draft);
    applySettingsDefaults(draft);
    toast.success("设置已保存并应用");
  };

  // Both sides come from the same object shape with the same key order, so
  // stringify is a sound equality check here and stays correct as fields are
  // added. It gates 保存 / 还原 and drives the unsaved-changes hint — which
  // matters more now that 保存 sits in the header instead of under the fields.
  const dirty = JSON.stringify(draft) !== JSON.stringify(settings);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      <SettingsNav draft={draft} view={view} onSelect={selectView} />

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

        {/* max-w keeps the measure readable. A credential field stretched across a
            1440px window puts its label a screen-width away from its own hint.

            Labelled region, named for the open view: it makes each pane
            addressable on its own, so a selector for the channel pane cannot
            drift onto whatever else happens to be on the page. */}
        <div
          role="region"
          aria-label={
            view.kind === "channel"
              ? "渠道配置"
              : view.kind === "general"
                ? "通用默认值"
                : "角色预设"
          }
          className="mx-auto max-w-4xl space-y-6 px-6 py-7"
        >
          {view.kind === "channel" ? (
            <ChannelView provider={view.provider} draft={draft} patch={patch} />
          ) : view.kind === "general" ? (
            <>
              <PaneHeader
                eyebrow="全局 · 通用默认值"
                title="通用默认值"
                desc="对所有渠道生效，新建任务时作为初始值。改完记得按右上角保存。"
              />
              <Card title="并发请求数">
                <ConcurrencyPanel draft={draft} patch={patch} />
              </Card>
              <Card title="默认画面参数">
                <ImageDefaultsPanel draft={draft} patch={patch} />
              </Card>
            </>
          ) : (
            <>
              <PaneHeader
                eyebrow="全局 · 角色预设"
                title="角色预设"
                desc="同人图批量会用到。这里的改动即时写入，不需要按右上角的保存。"
              />
              <Card>
                <PresetManager />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChannelView({
  provider,
  draft,
  patch,
}: {
  provider: ProviderId;
  draft: Settings;
  patch: (patch: Partial<Settings>) => void;
}) {
  const meta = providerMeta(provider);
  const label = splitProviderLabel(meta?.label ?? provider);
  const issue = providerSetupIssue(draft, provider);
  const isCurrent = draft.provider === provider;

  return (
    <>
      <PaneHeader
        eyebrow={`渠道 · ${label.name}`}
        title={label.name}
        tag={label.tag}
        desc={meta?.desc}
        action={
          isCurrent ? (
            <span className="flex items-center gap-1.5 rounded-md border border-success/40 px-2.5 py-1 text-xs text-success">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> 当前生成渠道
            </span>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => patch({ provider })}
              disabled={issue !== null}
              title={issue ? `还需填写：${issue}` : undefined}
            >
              切换为当前
            </Button>
          )
        }
      />

      <p className="flex gap-2 rounded-lg border border-dashed border-border/60 bg-surface/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          <span className="text-foreground/80">免费额度：</span>
          {meta?.quota}
        </span>
      </p>

      <Card title="凭证">
        <ProviderPanel provider={provider} draft={draft} patch={patch} />
        {issue && <p className="mt-4 text-xs text-warning">还需填写：{issue}</p>}
      </Card>
    </>
  );
}
