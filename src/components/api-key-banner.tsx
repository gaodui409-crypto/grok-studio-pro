import { useEffect, useState } from "react";
import { loadSettings } from "@/lib/settings";
import { AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ApiKeyBanner() {
  const [hasKey, setHasKey] = useState(true);
  useEffect(() => {
    const check = () => setHasKey(!!loadSettings().apiKey);
    check();
    window.addEventListener("grok-settings-changed", check);
    return () => window.removeEventListener("grok-settings-changed", check);
  }, []);
  if (hasKey) return null;
  return (
    <div className="mb-6 flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
      <span className="text-foreground/90">
        尚未配置 xAI API Key，请前往
        <Link to="/settings" className="mx-1 font-semibold text-primary-glow underline-offset-4 hover:underline">
          设置
        </Link>
        添加。
      </span>
    </div>
  );
}
