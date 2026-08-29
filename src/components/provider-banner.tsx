import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { loadSettings, PROVIDER_FEATURES } from "@/lib/settings";
import { providerLabel } from "@/lib/xai";

export function ProviderUnsupportedBanner({ feature }: { feature: "i2i" | "video" }) {
  const [s, setS] = useState(loadSettings);
  useEffect(() => {
    const h = () => setS(loadSettings());
    window.addEventListener("grok-settings-changed", h);
    return () => window.removeEventListener("grok-settings-changed", h);
  }, []);
  const supported = PROVIDER_FEATURES[s.provider][feature];
  if (supported) return null;
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
