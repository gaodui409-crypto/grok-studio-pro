import { Sliders, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { PROVIDERS, type ProviderId, type Settings } from "@/lib/settings";
import {
  providerStatus,
  splitProviderLabel,
  STATUS_LABELS,
  type ProviderStatus,
} from "@/lib/provider-status";

const DOT_CLASS: Record<ProviderStatus, string> = {
  ready: "bg-success",
  limited: "bg-warning",
  unset: "bg-muted-foreground/40",
};

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 px-3 py-4 last:border-b-0">
      <h2 className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function ChannelRow({
  label,
  status,
  active,
  current,
  onClick,
}: {
  label: string;
  status: ProviderStatus;
  active: boolean;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(
        "relative flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
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
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_CLASS[status])} aria-hidden />
      <span className="truncate">{label}</span>
      {/* The dot alone encodes state in colour only, which nothing but a sighted
          user can read. */}
      <span className="sr-only">{STATUS_LABELS[status]}</span>
      {current && (
        <span className="ml-auto shrink-0 rounded border border-success/40 px-1.5 py-0.5 text-[10px] font-normal text-success">
          当前
        </span>
      )}
    </button>
  );
}

function JumpRow({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Sliders;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-surface/60 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function SettingsNav({
  draft,
  selected,
  onSelect,
  onJump,
}: {
  draft: Settings;
  selected: ProviderId;
  onSelect: (provider: ProviderId) => void;
  onJump: (section: "general" | "presets") => void;
}) {
  return (
    <nav
      aria-label="设置导航"
      className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-[236px] shrink-0 flex-col border-r border-border/60 bg-card/40"
    >
      <div className="flex-1 overflow-y-auto">
        <NavSection title="渠道">
          {PROVIDERS.map((provider) => (
            <ChannelRow
              key={provider.id}
              label={splitProviderLabel(provider.label).name}
              status={providerStatus(draft, provider.id)}
              active={selected === provider.id}
              current={draft.provider === provider.id}
              onClick={() => onSelect(provider.id)}
            />
          ))}
        </NavSection>

        {/* Jump links, not destinations: 通用默认值 and 角色预设 are always
            rendered below the channel panel, so one 保存 covers everything the
            page can change. */}
        <NavSection title="通用">
          <JumpRow icon={Sliders} label="并发 / 默认值" onClick={() => onJump("general")} />
          <JumpRow icon={Users} label="角色预设" onClick={() => onJump("presets")} />
        </NavSection>
      </div>

      <p className="border-t border-border/60 p-4 text-[11px] leading-relaxed text-muted-foreground">
        凭证只写入当前浏览器的 localStorage，不上传任何服务器。
      </p>
    </nav>
  );
}
