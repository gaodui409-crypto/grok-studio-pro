import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { PROVIDER_FEATURES } from "@/lib/settings";
import { useSettings } from "@/hooks/use-settings";
import { providerLabel } from "@/lib/xai";

export function ProviderUnsupportedBanner({ feature }: { feature: "i2i" | "video" }) {
  const { settings: s, ready } = useSettings();
  // Before settings load, the default provider is xAI, which supports everything
  // — so this renders nothing either way. Gating on `ready` keeps it honest for
  // whatever the default becomes later.
  const supported = PROVIDER_FEATURES[s.provider][feature];
  if (!ready || supported) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
      <span className="text-foreground/90">
        当前来源（{providerLabel(s.provider)}）不支持此功能，请前往
        <Link
          to="/settings"
          className="mx-1 font-semibold text-primary-glow underline-offset-4 hover:underline"
        >
          设置
        </Link>
        切换至「xAI / NewAPI」。
      </span>
    </div>
  );
}
