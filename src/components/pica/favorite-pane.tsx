import { useEffect } from "react";
import { usePicaStore } from "@/lib/pica/store";
import { ComicCard } from "@/components/pica/comic-card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Heart, Download } from "lucide-react";
import { toast } from "sonner";

export function FavoritePane({ onPickComic }: { onPickComic: (comic: unknown) => void }) {
  const {
    favoriteSort,
    favoriteResult,
    favoriteLoading,
    favoriteError,
    setFavoriteSort,
    loadFavorites,
    downloadAllFavorites,
    bulkLoading,
    bulkMessage,
  } = usePicaStore();

  useEffect(() => {
    loadFavorites();
  }, [favoriteSort, loadFavorites]);

  const handleDownloadAll = async () => {
    if (!favoriteResult?.docs.length) {
      toast.error("收藏夹为空");
      return;
    }
    await downloadAllFavorites();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Tabs value={favoriteSort} onValueChange={(v) => setFavoriteSort(v as typeof favoriteSort)}>
          <TabsList>
            <TabsTrigger value="dd">最新收藏</TabsTrigger>
            <TabsTrigger value="da">最早收藏</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          size="sm"
          onClick={handleDownloadAll}
          disabled={favoriteLoading || bulkLoading === "favorites"}
        >
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {bulkLoading === "favorites" ? "下载中…" : "下载全部收藏"}
        </Button>
      </div>

      {bulkMessage && <p className="text-xs text-muted-foreground">{bulkMessage}</p>}

      {favoriteError && <p className="text-xs text-destructive">{favoriteError}</p>}

      {favoriteLoading && favoriteResult?.docs.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : favoriteResult?.docs.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <Heart className="mx-auto mb-2 h-8 w-8 opacity-40" />
          收藏夹为空
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            共 {favoriteResult?.total ?? 0} 部收藏漫画
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {favoriteResult?.docs.map((comic) => (
              <ComicCard key={comic._id} comic={comic} onClick={onPickComic} mode="favorite" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
