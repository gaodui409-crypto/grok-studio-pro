import { useEffect, useState } from "react";
import { defaultSettings, loadSettings, saveSettings, type Settings } from "@/lib/settings";

// Starts from defaultSettings on the very first render — NOT from localStorage.
// The server has no localStorage, so seeding state with loadSettings() made the
// first client render disagree with the server HTML and React threw a hydration
// mismatch on every page for anyone who had ever saved settings. Reading in an
// effect costs one extra render (a brief flash of defaults) and is the documented
// way to hydrate browser-only state.
//
// `ready` lets callers hide settings-derived UI until the real values arrive,
// instead of flashing "not configured" at a user who is configured.
export function useSettings() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
    setReady(true);
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

  return { settings, update, ready };
}
