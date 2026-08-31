import { useCallback, useEffect, useState } from "react";
import { useSettings } from "./use-settings";
import { loadLedger, quotaStatus, QUOTA_CHANGED_EVENT, type QuotaStatus } from "@/lib/quota";
import type { ProviderId } from "@/lib/settings";

/**
 * Today's local tally for one channel, refreshed as generation spends it.
 *
 * Starts at an empty ledger rather than reading localStorage in the initial
 * state, for the same reason useSettings does: the server has no localStorage,
 * so seeding from it makes the first client render disagree with the server HTML
 * and React throws a hydration mismatch. `ready` lets callers hide the figure
 * until the real numbers arrive instead of flashing "0 已用".
 *
 * Listens for QUOTA_CHANGED_EVENT (dispatched by quota.ts on every write) so a
 * running batch updates the number as it goes — the one moment the remaining
 * count actually matters is while something is spending it.
 */
export function useQuota(provider?: ProviderId) {
  const { settings, ready: settingsReady } = useSettings();
  const target = provider ?? settings.provider;
  const [status, setStatus] = useState<QuotaStatus | null>(null);

  const refresh = useCallback(() => {
    setStatus(quotaStatus(settings, target, loadLedger()));
  }, [settings, target]);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener(QUOTA_CHANGED_EVENT, handler);
    // Another tab generating on the same channel spends the same vendor allowance,
    // so its writes belong in this number too.
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(QUOTA_CHANGED_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [refresh]);

  return { status, ready: settingsReady && status !== null, refresh };
}
