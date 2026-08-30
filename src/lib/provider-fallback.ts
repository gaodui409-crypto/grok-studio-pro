import { enabledProviders, fallbackProviders, type ProviderId, type Settings } from "./settings.ts";
import { loadLedger, quotaStatus } from "./quota.ts";

export type ProviderChoice = {
  provider: ProviderId;
  /** Set when the requested provider was skipped, for a toast explaining why. */
  switchedFrom?: ProviderId;
  reason?: "exhausted" | "unconfigured";
};

// Picks which channel actually handles a request.
//
// The design (concept 04 / 09) asks for "switch to the next available channel
// once the daily cap is reached". Order comes from PROVIDERS, so it is the same
// order the user sees in settings — a hidden priority list they cannot see or
// change would make failures inexplicable.
//
// Deliberately NOT a retry-on-error mechanism: a 429 from the vendor could mean
// their cap, a rate limit, or a bad key, and silently re-firing the same prompt
// at a second channel could double-charge a paid one. This only redirects when
// the *local* tally says the chosen channel is spent, before any request goes out.
export function chooseProvider(settings: Settings, requested?: ProviderId): ProviderChoice {
  const target = requested ?? settings.provider;
  const ledger = loadLedger();

  // The chosen channel is judged by enabledProviders (an explicit pick is
  // honoured, anonymous Horde included); only the *replacements* come from the
  // narrower fallbackProviders list.
  const configured = enabledProviders(settings).includes(target);
  if (configured && !quotaStatus(settings, target, ledger).exhausted) {
    return { provider: target };
  }

  const alternative = fallbackProviders(settings).find(
    (candidate) => candidate !== target && !quotaStatus(settings, candidate, ledger).exhausted,
  );

  // No alternative: hand back the original so the provider's own error surfaces.
  // Inventing a "quota exhausted" error here would be a guess — the local tally
  // can be wrong, and the vendor may well still serve the request.
  if (!alternative) return { provider: target };

  return {
    provider: alternative,
    switchedFrom: target,
    reason: configured ? "exhausted" : "unconfigured",
  };
}
