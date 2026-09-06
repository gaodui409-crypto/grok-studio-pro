import { Link, useRouterState } from "@tanstack/react-router";
import {
  ImageIcon,
  Wand2,
  Film,
  Sparkles,
  Settings as SettingsIcon,
  Images,
  BookOpen,
  Download as DownloadIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const items = [
  { title: "文生图", url: "/", icon: ImageIcon },
  { title: "图生图", url: "/edit", icon: Wand2 },
  { title: "视频生成", url: "/video", icon: Film },
  { title: "同人图批量", url: "/fanart", icon: Sparkles },
  { title: "漫画工具", url: "/comic", icon: BookOpen },
  { title: "漫画下载", url: "/pica", icon: DownloadIcon },
  { title: "画廊", url: "/gallery", icon: Images },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border/60">
        {/* px-0 when collapsed, and the mark is 32px with shrink-0.
            The icon rail is 48px; the header's own p-2 leaves 32px, and this
            link's px-2 left only 16px. Without shrink-0 the 36px mark was
            squeezed to 20×36 — a rounded square rendered as a vertical
            rectangle with a stretched glyph inside. 32px also matches the
            collapsed menu buttons below, so the marks line up in one column. */}
        <Link
          to="/"
          className="flex items-center gap-2 px-2 py-3 group-data-[collapsible=icon]:px-0"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-display text-base font-semibold tracking-tight">Grok Studio</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              xAI Imagine
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>创作</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/60">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/settings")} tooltip="设置">
              <Link to="/settings" className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4" />
                <span>设置</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
