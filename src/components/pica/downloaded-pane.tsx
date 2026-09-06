import { usePicaStore } from "@/lib/pica/store";
import { ComicCard } from "@/components/pica/comic-card";
import type { ComicInSearch } from "@/lib/pica/types";
import { Button } from "@/components/ui/button";
import { Loader2, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export function DownloadedPane({ onPickComic }: { onPickComic: (comic: unknown) => void }) {
  const { downloadedComics, downloadedLoading, downloadedError, loadDownloaded } = usePicaStore();

  // 不在挂载时自动调用 loadDownloaded：它会弹出系统目录选择框，登录后自动弹出非常突兀。
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">已下载漫画（从本地文件夹读取）</p>
        <Button size="sm" variant="secondary" onClick={loadDownloaded} disabled={downloadedLoading}>
          <FolderOpen className="mr-1.5 h-3.5 w-3.5" />
          {downloadedLoading ? "读取中…" : "选择下载文件夹"}
        </Button>
      </div>

      {downloadedError && <p className="text-xs text-destructive">{downloadedError}</p>}

      {downloadedLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : downloadedComics.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <FolderOpen className="mx-auto mb-2 h-8 w-8 opacity-40" />
          点击"选择下载文件夹"来读取本地已下载的漫画
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">共 {downloadedComics.length} 部漫画</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {downloadedComics.map((comic) => (
              <ComicCard
                key={comic._id}
                comic={comic as unknown as ComicInSearch}
                onClick={onPickComic}
                mode="downloaded"
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
