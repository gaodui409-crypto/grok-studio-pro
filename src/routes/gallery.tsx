import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2, Download, Search, AlertTriangle, CheckSquare, Square } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";
import { saveBlob } from "@/lib/download";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { GalleryFacetNav } from "@/components/gallery/gallery-facet-nav";
import { GalleryCard } from "@/components/gallery/gallery-card";
import { GalleryPreview } from "@/components/gallery/gallery-preview";
import { useGalleryItems } from "@/hooks/use-gallery-items";
import { useObjectUrls } from "@/hooks/use-object-urls";
import {
  applyFilter,
  computeFacets,
  emptyFilter,
  isFiltered,
  type GalleryFilter,
  type SortOrder,
} from "@/lib/gallery-filter";
import { getGalleryItem, deleteGalleryItems, clearGallery } from "@/lib/gallery-db";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "画廊 — Grok Studio" },
      { name: "description", content: "本地持久化画廊：管理、筛选、批量下载已生成的图片与视频。" },
    ],
  }),
  component: GalleryPage,
});

const PAGE_SIZE = 48;

const SORT_LABELS: Record<SortOrder, string> = {
  newest: "最新优先",
  oldest: "最早优先",
  largest: "体积最大",
};

function extOf(mime: string, type?: string) {
  if (type === "video") return "mp4";
  const sub = mime.split("/")[1] || "png";
  return sub.split(";")[0];
}

function GalleryPage() {
  const { items, storage, ready, error, refresh } = useGalleryItems();
  const [filter, setFilter] = useState<GalleryFilter>(emptyFilter);
  const [sort, setSort] = useState<SortOrder>("newest");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const [showCleanupAfter, setShowCleanupAfter] = useState(false);

  const filtered = useMemo(() => applyFilter(items, filter, sort), [items, filter, sort]);
  const facets = useMemo(() => computeFacets(items, filter), [items, filter]);
  const visible = useMemo(() => filtered.slice(0, limit), [filtered, limit]);
  const urls = useObjectUrls(useMemo(() => visible.map((item) => item.id), [visible]));

  // A narrower filter can leave the offset past the end of the new result set,
  // which would render an empty grid under a non-zero count.
  useEffect(() => setLimit(PAGE_SIZE), [filter, sort]);

  const patchFilter = (patch: Partial<GalleryFilter>) =>
    setFilter((current) => ({ ...current, ...patch }));

  const allSelected = filtered.length > 0 && filtered.every((item) => selected.has(item.id));
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set(filtered.map((item) => item.id)));
  const toggleOne = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const downloadOne = async (id: string) => {
    const full = await getGalleryItem(id);
    if (!full) return;
    saveBlob(full.blob, `grok-${id}.${extOf(full.mimeType, full.type)}`);
  };

  const copyPrompt = async (prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    toast.success("提示词已复制");
  };

  const downloadSelectedZip = async () => {
    if (!selected.size) return toast.error("请先勾选项目");
    setZipping(true);
    setZipProgress(0);
    const zip = new JSZip();
    const ids = Array.from(selected);
    for (let i = 0; i < ids.length; i++) {
      const full = await getGalleryItem(ids[i]);
      if (full) {
        const folder = full.type === "video" ? "videos" : full.sceneName || "images";
        const safe = folder.replace(/[^\w一-龥-]/g, "_");
        zip.file(`${safe}/${full.id}.${extOf(full.mimeType, full.type)}`, full.blob);
      }
      setZipProgress(Math.round(((i + 1) / ids.length) * 100));
    }
    saveBlob(await zip.generateAsync({ type: "blob" }), `grok-gallery-${Date.now()}.zip`);
    setZipping(false);
    setShowCleanupAfter(true);
  };

  const deleteSelected = async () => {
    if (!selected.size) return;
    await deleteGalleryItems(Array.from(selected));
    setSelected(new Set());
    toast.success("已删除选中项目");
    await refresh();
  };

  // Preview walks the loaded page, not the whole filtered set: past the page
  // boundary there is no object URL yet, so arrow keys would land on a blank.
  const previewIndex = previewId ? visible.findIndex((item) => item.id === previewId) : -1;
  const previewItem = previewIndex >= 0 ? visible[previewIndex] : null;

  const navigatePreview = useCallback(
    (direction: -1 | 1) => {
      if (previewIndex < 0 || !visible.length) return;
      const next = (previewIndex + direction + visible.length) % visible.length;
      setPreviewId(visible[next].id);
    },
    [previewIndex, visible],
  );

  const remaining = filtered.length - visible.length;
  // Nothing stored means nothing to filter, sort or select. The facet nav would
  // be a column of zeros and the toolbar a row of disabled buttons, so both stay
  // out of the way until there is something to act on.
  const hasArchive = items.length > 0;

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)]">
      {hasArchive && (
        <GalleryFacetNav
          facets={facets}
          filter={filter}
          onChange={patchFilter}
          storage={storage}
          selectedCount={selected.size}
          onClearSelection={() => setSelected(new Set())}
        />
      )}

      <div className="min-w-0 flex-1">
        {/* Same sticky header as 设置: the toolbar is the thing you reach for
            repeatedly, so it should not scroll away behind 48 cards. */}
        <div className="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur-xl">
          <div className="min-w-0">
            <h1 className="truncate font-display text-lg font-semibold tracking-tight">画廊</h1>
            {/* The count was the h1 at 30px — display type for what is really a
                status line, and it restated the word above it. As a status region
                it also announces itself when the filter changes. */}
            <p className="truncate text-xs text-muted-foreground" role="status">
              {isFiltered(filter) ? "筛选结果" : "全部生成结果"} {filtered.length} 项 · IndexedDB
              永久归档，关闭页面不丢
            </p>
          </div>

          {hasArchive && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter.search}
                  onChange={(event) => patchFilter({ search: event.target.value })}
                  placeholder="搜索提示词…"
                  aria-label="搜索提示词"
                  className="h-9 w-56 pl-9"
                />
              </div>
              <Select value={sort} onValueChange={(value) => setSort(value as SortOrder)}>
                <SelectTrigger className="h-9 w-40" aria-label="排序方式">
                  <SelectValue placeholder={SORT_LABELS[sort]} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABELS) as SortOrder[]).map((value) => (
                    <SelectItem key={value} value={value}>
                      排序：{SORT_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="sm" onClick={toggleAll} disabled={!filtered.length}>
                {allSelected ? (
                  <CheckSquare className="mr-1 h-4 w-4" />
                ) : (
                  <Square className="mr-1 h-4 w-4" />
                )}
                {allSelected ? "取消全选" : `全选 (${filtered.length})`}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={!items.length}
                    className="text-destructive hover:text-destructive"
                  >
                    <AlertTriangle className="mr-1 h-4 w-4" /> 清空全部
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>清空整个画廊？</AlertDialogTitle>
                    <AlertDialogDescription>
                      将删除全部 {items.length} 个项目，此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        await clearGallery();
                        setSelected(new Set());
                        await refresh();
                        toast.success("画廊已清空");
                      }}
                    >
                      确认清空
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

        <div className="px-6 py-6">
          {error && (
            <div className="mb-4 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              读取画廊失败：{error}
            </div>
          )}

          {zipping && (
            <div className="mb-4 space-y-2 rounded-xl border border-border/60 bg-card p-3 text-xs">
              <div className="flex justify-between">
                <span>打包中…</span>
                <span className="font-mono">{zipProgress}%</span>
              </div>
              <Progress value={zipProgress} />
            </div>
          )}

          {visible.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-12 text-center text-sm text-muted-foreground">
              {!ready
                ? "正在读取本地归档…"
                : items.length === 0
                  ? "还没有内容，去生成一些吧～"
                  : "当前筛选条件下没有内容"}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {visible.map((item) => (
                  <GalleryCard
                    key={item.id}
                    item={item}
                    url={urls[item.id]}
                    selected={selected.has(item.id)}
                    onToggleSelect={() => toggleOne(item.id)}
                    onPreview={() => setPreviewId(item.id)}
                    onCopyPrompt={() => void copyPrompt(item.prompt)}
                    onDownload={() => void downloadOne(item.id)}
                    onDelete={async () => {
                      await deleteGalleryItems([item.id]);
                      await refresh();
                    }}
                  />
                ))}
              </div>

              {remaining > 0 && (
                <div className="mt-4">
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => setLimit((current) => current + PAGE_SIZE)}
                  >
                    加载更多（剩余 {remaining} 项）
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-xl border border-border/60 bg-card/95 p-2 shadow-glow backdrop-blur">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void deleteSelected()}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-1 h-4 w-4" /> 删除选中 ({selected.size})
          </Button>
          <Button size="sm" disabled={zipping} onClick={() => void downloadSelectedZip()}>
            <Download className="mr-1 h-4 w-4" /> 打包下载 ({selected.size})
          </Button>
        </div>
      )}

      <GalleryPreview
        item={previewItem}
        url={previewItem ? urls[previewItem.id] : undefined}
        index={previewIndex}
        total={visible.length}
        onNavigate={navigatePreview}
        onClose={() => setPreviewId(null)}
      />

      <AlertDialog open={showCleanupAfter} onOpenChange={setShowCleanupAfter}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>清除已下载内容？</AlertDialogTitle>
            <AlertDialogDescription>
              已成功打包下载 {selected.size} 项。是否从浏览器存储中删除它们以释放空间？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保留</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await deleteGalleryItems(Array.from(selected));
                setSelected(new Set());
                setShowCleanupAfter(false);
                await refresh();
                toast.success("已清除已下载内容");
              }}
            >
              清除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
