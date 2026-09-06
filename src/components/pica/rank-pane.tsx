import { useEffect } from "react";
import { usePicaStore } from "@/lib/pica/store";
import { ComicCard } from "@/components/pica/comic-card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, TrendingUp } from "lucide-react";

export function RankPane({ onPickComic }: { onPickComic: (comic: unknown) => void }) {
  const { rankType, rankResult, rankLoading, rankError, setRankType, loadRank } = usePicaStore();

  useEffect(() => {
    loadRank();
  }, [rankType, loadRank]);

  return (
    <div className="space-y-5">
      <Tabs value={rankType} onValueChange={(v) => setRankType(v as typeof rankType)}>
        <TabsList>
          <TabsTrigger value="H24">日榜</TabsTrigger>
          <TabsTrigger value="D7">周榜</TabsTrigger>
          <TabsTrigger value="D30">月榜</TabsTrigger>
        </TabsList>
      </Tabs>

      {rankError && <p className="text-xs text-destructive">{rankError}</p>}

      {rankLoading && rankResult.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rankResult.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          <TrendingUp className="mx-auto mb-2 h-8 w-8 opacity-40" />
          排行榜暂无数据
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">共 {rankResult.length} 部漫画</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rankResult.map((comic) => (
              <ComicCard key={comic._id} comic={comic} onClick={onPickComic} mode="rank" />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
