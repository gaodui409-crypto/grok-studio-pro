import { useEffect, useState } from "react";
import { loadSettings, saveSettings, type Settings } from "@/lib/settings";

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    const handler = () => setSettings(loadSettings());
    window.addEventListener("grok-settings-changed", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("grok-settings-changed", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const update = (next: Settings) => {
    saveSettings(next);
    setSettings(next);
  };

  return { settings, update };
}
