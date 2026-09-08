import { chromium, type FullConfig } from "@playwright/test";
import { installOfflineNetwork } from "./offline-network";

const ROUTES = ["/", "/edit", "/video", "/fanart", "/comic", "/gallery", "/settings", "/pica"];

// Warms Vite's dev module graph before the suite runs.
//
// The flake this fixes: on a cold server, the FIRST visit to a route compiles it
// on demand, and React then reports an attribute-level hydration mismatch — the
// SSR pass and the client bundle disagree while the graph is still settling. It
// showed up on roughly 1 run in 3, on whichever route happened to be compiled
// first, which is why it looked random.
//
// Fetching each route once, serially, forces that compilation to finish before
// any assertion depends on it. This is a dev-server artifact, not a product bug:
// a built app serves pre-compiled output, so there is nothing to warm there.
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL;
  if (!baseURL) return;

  const browser = await chromium.launch();
  const context = await browser.newContext({ serviceWorkers: "block" });
  await installOfflineNetwork(context, baseURL);
  const page = await context.newPage();
  try {
    for (const route of ROUTES) {
      try {
        await page.goto(new URL(route, baseURL).toString(), {
          waitUntil: "networkidle",
          timeout: 60_000,
        });
        // Wait for the client to take over, so the client bundle for this route is
        // compiled too — an SSR-only fetch leaves half the graph cold.
        await page
          .waitForFunction(() => document.documentElement.dataset.hydrated === "1", null, {
            timeout: 30_000,
          })
          .catch(() => {
            // Warmup is best-effort: a route that fails here will simply be
            // compiled by its own test, which is the pre-warmup behaviour.
          });
      } catch {
        continue;
      }
    }
  } finally {
    await browser.close();
  }
}
