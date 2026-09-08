import type { BrowserContext } from "@playwright/test";

export async function installOfflineNetwork(context: BrowserContext, baseURL: string) {
  const origin = new URL(baseURL).origin;
  const blocked: { method: string; origin: string; pathname: string }[] = [];
  await context.route("**/*", (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // Keep font loading offline without introducing unrelated console errors.
    if (url.hostname === "fonts.googleapis.com" && request.resourceType() === "stylesheet") {
      return route.fulfill({ contentType: "text/css", body: "" });
    }
    if (url.origin === origin && !url.pathname.startsWith("/_server/")) {
      return route.continue();
    }
    blocked.push({ method: request.method(), origin: url.origin, pathname: url.pathname });
    return route.abort("blockedbyclient");
  });
  return blocked;
}
