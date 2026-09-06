import { useCallback, useEffect, useRef, useState } from "react";
import { usePicaStore } from "@/lib/pica/store";
import { ComicCard } from "@/components/pica/comic-card";
import { Search, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export function SearchPane({ onPickComic }: { onPickComic: (comic: unknown) => void }) {
  const {
    searchKeyword,
    searchSort,
    searchCategories,
    searchResult,
    searchLoading,
    searchError,
    setSearchKeyword,
    setSearchSort,
    setSearchCategories,
    search,
    clearSearch,
  } = usePicaStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [localKw, setLocalKw] = useState(searchKeyword);

  useEffect(() => {
    setLocalKw(searchKeyword);
  }, [searchKeyword]);

  const handleSearch = useCallback(async () => {
    setSearchKeyword(localKw);
    await search();
  }, [localKw, search, setSearchKeyword]);

  const handlePick = (comic: unknown) => {
    onPickComic(comic);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">搜索漫画</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={localKw}
              onChange={(e) => setLocalKw(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="输入漫画名称、作者或标签…"
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={searchLoading}>
            {searchLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
          </Button>
          {searchResult && (
            <Button variant="ghost" size="icon" onClick={clearSearch}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <Tabs value={searchSort} onValueChange={(v) => setSearchSort(v as typeof searchSort)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dd">新到旧</TabsTrigger>
          <TabsTrigger value="da">旧到新</TabsTrigger>
          <TabsTrigger value="ld">最多喜欢</TabsTrigger>
          <TabsTrigger value="vd">最多指名</TabsTrigger>
        </TabsList>
      </Tabs>

      {searchError && <p className="text-xs text-destructive">{searchError}</p>}

      {searchResult && (
        <>
          <p className="text-xs text-muted-foreground">
            共 {searchResult.total} 条结果，第 {searchResult.page} / {searchResult.pages} 页
          </p>
          {searchResult.docs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              没有找到匹配的漫画
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {searchResult.docs.map((comic) => (
                <ComicCard key={comic._id} comic={comic} onClick={handlePick} mode="search" />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
