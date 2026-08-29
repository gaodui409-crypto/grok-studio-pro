import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { loadSettings } from "@/lib/settings";
import { useAppStore } from "@/lib/app-store";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Grok Studio — xAI 图片与视频生成工作台" },
      {
        name: "description",
        content: "Grok Studio：调用 xAI Grok Imagine 在浏览器中生成图片、视频与同人图批量创作。",
      },
      { name: "author", content: "Grok Studio" },
      { property: "og:title", content: "Grok Studio — xAI 图片与视频生成工作台" },
      {
        property: "og:description",
        content: "Grok Studio：调用 xAI Grok Imagine 在浏览器中生成图片、视频与同人图批量创作。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Grok Studio — xAI 图片与视频生成工作台" },
      {
        name: "twitter:description",
        content: "Grok Studio：调用 xAI Grok Imagine 在浏览器中生成图片、视频与同人图批量创作。",
      },
      {
        property: "og:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5479d024-5fcb-4117-8b14-02fc6877e39a/id-preview-813b6095--44488e47-94b3-422f-af4b-69c0395f3d3f.lovable.app-1777553668354.png",
      },
      {
        name: "twitter:image",
        content:
          "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/5479d024-5fcb-4117-8b14-02fc6877e39a/id-preview-813b6095--44488e47-94b3-422f-af4b-69c0395f3d3f.lovable.app-1777553668354.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const applySettingsDefaults = useAppStore((state) => state.applySettingsDefaults);

  useEffect(() => {
    applySettingsDefaults(loadSettings());
    // Marks the point where the client has taken over from the SSR HTML. The e2e
    // suite waits on this before screenshotting, because several widgets (Radix
    // select triggers) render blank server-side and only fill in after hydration.
    document.documentElement.dataset.hydrated = "1";
  }, [applySettingsDefaults]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border/60" />
            <span className="font-display text-sm font-medium tracking-tight text-muted-foreground">
              Grok Studio · 浏览器端 xAI 创作工作台
            </span>
          </header>
          <main className="flex-1">
            <Outlet />
          </main>
          <Toaster />
        </div>
      </div>
    </SidebarProvider>
  );
}
