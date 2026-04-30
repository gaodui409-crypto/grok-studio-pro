import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Images, Trash2, Download, Copy, Maximize2, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import {
  listGallery, getGalleryItem, deleteGalleryItems, clearGallery,
  getStorageEstimate, formatBytes, type GalleryMeta,
} from "@/lib/gallery-db";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "画廊 — Grok Studio" },
      { name: "description", content: "本地持久化画廊：管理、筛选、批量下载已生成的图片。" },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  const [items, setItems] = useState<GalleryMeta[]>([]);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [urlCache, setUrlCache] = useState<Record<string, string>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterScene, setFilterScene] = useState<string>("all");
  const [filterChar, setFilterChar] = useState<string>("all");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    const list = await listGallery();
    setItems(list);
    setStorage(await getStorageEstimate());
  };

  useEffect(() => {
    refresh();
    const h = () => refresh();
    window.addEventListener("grok-gallery-changed", h);
    return () => window.removeEventListener("grok-gallery-changed", h);
  }, []);

  // Load thumbnails (object URLs) lazily
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const it of items) {
        if (urlCache[it.id]) continue;
        const full = await getGalleryItem(it.id);
        if (cancelled || !full) continue;
        const url = URL.createObjectURL(full.blob);
        setUrlCache((c) => ({ ...c, [it.id]: url }));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  // Cleanup object URLs on unmount
  useEffect(() => () => {
    Object.values(urlCache).forEach((u) => URL.revokeObjectURL(u));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenes = useMemo(() => Array.from(new Set(items.map((i) => i.sceneName).filter(Boolean))) as string[], [items]);
  const chars = useMemo(() => Array.from(new Set(items.map((i) => i.character).filter(Boolean))) as string[], [items]);

  const filtered = useMemo(() => items.filter((i) => {
    if (filterScene !== "all" && i.sceneName !== filterScene) return false;
    if (filterChar !== "all" && i.character !== filterChar) return false;
    if (search.trim() && !i.prompt.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, filterScene, filterChar, search]);

  const allSelected = filtered.length > 0 && filtered.every((i) => selected.has(i.id));
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((i) => i.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const downloadOne = async (id: string) => {
    const full = await getGalleryItem(id);
    if (!full) return;
    const ext = full.mimeType.split("/")[1] || "png";
    saveAs(full.blob, `grok-${id}.${ext}`);
  };

  const copyPrompt = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    toast.success("提示词已复制");
  };

  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [showCleanupAfter, setShowCleanupAfter] = useState(false);

  const downloadSelectedZip = async () => {
    if (!selected.size) return toast.error("请先勾选图片");
    setZipping(true);
    setZipProgress(0);
    const zip = new JSZip();
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i++) {
      const full = await getGalleryItem(ids[i]);
      if (full) {
        const ext = full.mimeType.split("/")[1] || "png";
        const safe = (full.sceneName || "scene").replace(/[^\w\u4e00-\u9fa5-]/g, "_");
        zip.file(`${safe}/${full.id}.${ext}`, full.blob);
      }
      setZipProgress(Math.round(((i + 1) / ids.length) * 100));
    }
    const blob = await zip.generateAsync({ type: "blob" });
    saveAs(blob, `grok-gallery-${Date.now()}.zip`);
    setZipping(false);
    setShowCleanupAfter(true);
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    await deleteGalleryItems(Array.from(selected));
    setSelected(new Set());
    toast.success("已删除选中图片");
    refresh();
  };

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <PageHeader
        title="画廊"
        description="所有生成的图片永久保存在浏览器（IndexedDB），关闭页面也不会丢失。"
        icon={Images}
      />

      {/* Storage bar */}
      {storage && storage.quota > 0 && (
        <div className="mb-4 rounded-xl border border-border/60 bg-card p-3 text-xs">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-muted-foreground">浏览器存储用量</span>
            <span className="font-mono">
              {formatBytes(storage.usage)} / {formatBytes(storage.quota)}
            </span>
          </div>
          <Progress value={(storage.usage / storage.quota) * 100} />
        </div>
      )}

      {/* Filters & actions */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border/60 bg-card p-4">
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">场景</Label>
          <Select value={filterScene} onValueChange={setFilterScene}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部场景</SelectItem>
              {scenes.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">角色</Label>
          <Select value={filterChar} onValueChange={setFilterChar}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部角色</SelectItem>
              {chars.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[180px] flex-1 space-y-1">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">搜索提示词</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="关键词…" className="h-9" />
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleAll}>
            {allSelected ? <CheckSquare className="mr-1 h-4 w-4" /> : <Square className="mr-1 h-4 w-4" />}
            {allSelected ? "取消全选" : "全选"}
          </Button>
          <Button
            size="sm" variant="secondary" disabled={!selected.size || zipping}
            onClick={downloadSelectedZip}
          >
            <Download className="mr-1 h-4 w-4" /> 打包下载 ({selected.size})
          </Button>
          <Button
            size="sm" variant="ghost" disabled={!selected.size}
            onClick={deleteSelected}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" /> 删除选中
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                <AlertTriangle className="mr-1 h-4 w-4" /> 清空全部
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>清空整个画廊？</AlertDialogTitle>
                <AlertDialogDescription>
                  将删除全部 {items.length} 张图片，此操作不可撤销。
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>取消</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => { await clearGallery(); setSelected(new Set()); refresh(); toast.success("画廊已清空"); }}
                >
                  确认清空
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {zipping && (
        <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-card p-3 text-xs">
          <div className="flex justify-between"><span>打包中…</span><span className="font-mono">{zipProgress}%</span></div>
          <Progress value={zipProgress} />
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-12 text-center text-sm text-muted-foreground">
          {items.length === 0 ? "还没有图片，去生成一些吧～" : "当前筛选条件下没有图片"}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((it) => {
            const url = urlCache[it.id];
            const isSel = selected.has(it.id);
            return (
              <div
                key={it.id}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-card transition",
                  isSel ? "border-primary shadow-glow" : "border-border/60 hover:border-primary/40",
                )}
              >
                <button
                  onClick={() => toggleOne(it.id)}
                  className="absolute left-2 top-2 z-10 rounded-md bg-background/80 p-1 backdrop-blur"
                >
                  {isSel ? <CheckSquare className="h-4 w-4 text-primary-glow" /> : <Square className="h-4 w-4" />}
                </button>
                {url ? (
                  <img src={url} alt={it.prompt} className="aspect-square w-full object-cover" loading="lazy" />
                ) : (
                  <div className="aspect-square w-full animate-pulse bg-surface" />
                )}
                <div className="space-y-1 p-2 text-[11px]">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="truncate">{it.sceneName || "—"}</span>
                    <span className="font-mono">{formatBytes(it.size)}</span>
                  </div>
                  <p className="line-clamp-2 text-foreground/80">{it.prompt}</p>
                </div>
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-background/95 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => url && setPreviewUrl(url)}>
                    <Maximize2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => copyPrompt(it.prompt)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-7 w-7" onClick={() => downloadOne(it.id)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon" variant="secondary" className="h-7 w-7 text-destructive"
                    onClick={async () => { await deleteGalleryItems([it.id]); refresh(); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl border-border/60 bg-background p-2">
          <DialogTitle className="sr-only">图片预览</DialogTitle>
          {previewUrl && <img src={previewUrl} alt="预览" className="max-h-[85vh] w-full rounded-lg object-contain" />}
        </DialogContent>
      </Dialog>

      <AlertDialog open={showCleanupAfter} onOpenChange={setShowCleanupAfter}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清除已下载图片？</AlertDialogTitle>
            <AlertDialogDescription>
              已成功打包下载 {selected.size} 张。是否从浏览器存储中删除它们以释放空间？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              await deleteGalleryItems(Array.from(selected));
              setSelected(new Set());
              setShowCleanupAfter(false);
              refresh();
              toast.success("已清除已下载图片");
            }}>
              清除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
