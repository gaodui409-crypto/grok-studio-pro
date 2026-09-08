import { useEffect, useMemo } from "react";
import { usePicaStore } from "@/lib/pica/store";
import { Download, Loader2, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { picaMediaUrl } from "@/lib/pica/types";

export function ChapterPane({ comic, onBack }: { comic: unknown; onBack: () => void }) {
  const {
    loadChapters,
    pickedChapters,
    chapterLoading,
    chapterError,
    downloadComic,
    downloadChapter,
    pickedComic,
  } = usePicaStore();

  const typedComic = useMemo(
    () =>
      comic as {
        _id: string;
        title: string;
        author: string;
        description: string;
        thumb: { path: string; fileServer: string; originalName: string };
        finished: boolean;
        likesCount: number;
        tags: string[];
        categories: string[];
        chapterCount: number;
      },
    [comic],
  );

  useEffect(() => {
    if (typedComic?._id) {
      loadChapters(typedComic._id);
    }
  }, [typedComic?._id, loadChapters]);

  const thumbSrc = typedComic.thumb?.path ? picaMediaUrl(typedComic.thumb) : "";

  const handleDownloadAll = async () => {
    if (!pickedComic) return;
    try {
      await downloadComic(pickedComic);
      toast.success("已开始下载所有章节");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const handleDownloadChapter = async (chapterId: string) => {
    if (!pickedComic) return;
    try {
      await downloadChapter(pickedComic, chapterId);
      toast.success("已开始下载章节");
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ChevronLeft className="mr-1 h-4 w-4" /> 返回
      </Button>

      <div className="flex gap-4 rounded-xl border border-border/60 bg-card p-4">
        {thumbSrc && (
          <img
            src={thumbSrc}
            alt={typedComic.title}
            className="h-32 w-24 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-semibold leading-tight">{typedComic.title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{typedComic.author}</p>
          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
            {typedComic.description}
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {typedComic.tags?.slice(0, 5).map((tag: string) => (
              <span
                key={tag}
                className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={handleDownloadAll} disabled={chapterLoading}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {chapterLoading ? "加载中…" : "下载全部章节"}
            </Button>
            <span className="text-xs text-muted-foreground">
              {typedComic.chapterCount} 章节 · {typedComic.finished ? "已完结" : "连载中"}
            </span>
          </div>
        </div>
      </div>

      {chapterError && <p className="text-xs text-destructive">{chapterError}</p>}

      {chapterLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="space-y-1.5">
            {pickedChapters?.docs.map((ch) => (
              <div
                key={ch._id}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-card/50 px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    第 {ch.order} 话 · {ch.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(ch.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => handleDownloadChapter(ch._id)}>
                  <Download className="mr-1 h-3.5 w-3.5" /> 下载
                </Button>
              </div>
            ))}
            {pickedChapters?.docs.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无章节</p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
