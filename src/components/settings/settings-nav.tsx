import { Sliders, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDERS, type ProviderId, type Settings } from "@/lib/settings";
import {
  providerStatus,
  splitProviderLabel,
  STATUS_LABELS,
  type ProviderStatus,
} from "@/lib/provider-status";

/**
 * Which pane fills the main column.
 *
 * 通用默认值 and 角色预设 used to be sections stacked under whichever channel was
 * open, which read as if they belonged to that channel — they are global. They
 * are now siblings of the channels in one exclusive selection, so the nav says
 * exactly one thing about where you are.
 */
export type SettingsView =
  | { kind: "channel"; provider: ProviderId }
  | { kind: "general" | "presets" };

const DOT_CLASS: Record<ProviderStatus, string> = {
  ready: "bg-success",
  limited: "bg-warning",
  unset: "bg-muted-foreground/40",
};

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 px-2 py-3 last:border-b-0">
      {/* A <p>, not a heading: these are group captions inside a nav. As h2 they
          competed with the pane's own h2, and "the second-level heading" stopped
          identifying anything. */}
      <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavRow({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition",
        active
          ? "bg-surface font-medium text-foreground"
          : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
      )}
    >
      {active && (
        <span
          className="absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-gradient-primary"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}

export function SettingsNav({
  draft,
  view,
  onSelect,
}: {
  draft: Settings;
  view: SettingsView;
  onSelect: (view: SettingsView) => void;
}) {
  return (
    <nav
      aria-label="设置导航"
      className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-[208px] shrink-0 flex-col border-r border-border/60 bg-card/40"
    >
      <div className="flex-1 overflow-y-auto">
        <NavSection title="渠道">
          {PROVIDERS.map((provider) => {
            const status = providerStatus(draft, provider.id);
            return (
              <NavRow
                key={provider.id}
                active={view.kind === "channel" && view.provider === provider.id}
                onClick={() => onSelect({ kind: "channel", provider: provider.id })}
              >
                <span
                  className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[status])}
                  aria-hidden
                />
                <span className="truncate">{splitProviderLabel(provider.label).name}</span>
                {/* The dot alone encodes state in colour only, which nothing but a
                    sighted user can read. */}
                <span className="sr-only">{STATUS_LABELS[status]}</span>
                {draft.provider === provider.id && (
                  <span className="ml-auto shrink-0 rounded border border-success/40 px-1.5 py-0.5 text-[10px] font-normal text-success">
                    当前
                  </span>
                )}
              </NavRow>
            );
          })}
        </NavSection>

        <NavSection title="全局">
          <NavRow active={view.kind === "general"} onClick={() => onSelect({ kind: "general" })}>
            <Sliders className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">通用默认值</span>
          </NavRow>
          <NavRow active={view.kind === "presets"} onClick={() => onSelect({ kind: "presets" })}>
            <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">角色预设</span>
          </NavRow>
        </NavSection>
      </div>

      <p className="border-t border-border/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
        凭证只写入当前浏览器的 localStorage，不上传任何服务器。
      </p>
    </nav>
  );
}
