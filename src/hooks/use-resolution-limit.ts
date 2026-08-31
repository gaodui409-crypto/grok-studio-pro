import { useEffect, useMemo } from "react";
import { useSettings } from "./use-settings";
import { clampTier, currentResolutionLimit } from "@/lib/resolution-limits";
import type { ResolutionTier } from "@/lib/settings";

/**
 * What the selected channel can deliver, plus a self-correcting selection.
 *
 * The two halves belong together. Greying out 2k is only half the fix: a user
 * who picked 2k on Gitee and then switched to SDXL would be left with a trigger
 * still reading "2k" and an option they can no longer choose, so the page would
 * submit a value the request path quietly reduces — exactly the behaviour the
 * greying-out is meant to expose. When `value` becomes unreachable this steps it
 * down to the highest tier that is (2k → 1.5k, not 2k → 1k) and reports it.
 *
 * `ready` from useSettings matters here: settings start as defaults on the first
 * render and only reach real values in an effect, so clamping before that could
 * step down against a provider the user is not actually on.
 */
export function useResolutionLimit(
  value: ResolutionTier,
  onChange: (tier: ResolutionTier) => void,
) {
  const { settings, ready } = useSettings();
  const provider = settings.provider;
  const limit = useMemo(() => currentResolutionLimit(settings), [settings]);

  const corrected = clampTier(value, limit);
  const needsClamp = ready && corrected !== value;

  useEffect(() => {
    if (needsClamp) onChange(corrected);
    // onChange identity is not stable across renders in these pages (it closes
    // over a zustand setter), so depending on it would re-run this every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsClamp, corrected]);

  return { limit, provider, ready };
}
