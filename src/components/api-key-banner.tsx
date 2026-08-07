import { useEffect, useState } from "react";
import { loadSettings, providerSetupIssue } from "@/lib/settings";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ApiKeyBanner() {
  const [missing, setMissing] = useState<string | null>(null);
  useEffect(() => {
    const check = () => {
      setMissing(providerSetupIssue(loadSettings()));
    };
    check();
    window.addEventListener("grok-settings-changed", check);
    return () => window.removeEventListener("grok-settings-changed", check);
  }, []);
  if (!missing) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
      <span className="text-foreground/90">
        尚未配置 {missing}，请前往
        <Link
          to="/settings"
          className="mx-1 font-semibold text-primary-glow underline-offset-4 hover:underline"
        >
          设置
        </Link>
        处理。
      </span>
    </div>
  );
}
