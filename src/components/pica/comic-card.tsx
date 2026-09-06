import type { ComicInSearch, ComicInFavorite, ComicInRank } from "@/lib/pica/types";
import { Download, Heart, TrendingUp, FileDown } from "lucide-react";

type ComicCardProps = {
  comic: ComicInSearch | ComicInFavorite | ComicInRank;
  onClick: (comic: ComicInSearch | ComicInFavorite | ComicInRank) => void;
  mode: "search" | "favorite" | "rank" | "downloaded";
};

export function ComicCard({ comic, onClick, mode }: ComicCardProps) {
  const thumb = comic.thumb?.path ?? "";
  const title = "title" in comic ? comic.title : "";
  const author = "author" in comic ? comic.author : "";
  const likes = comic.likesCount ?? 0;
  const isDownloaded = "isDownloaded" in comic ? comic.isDownloaded : false;
  const categories = ("categories" in comic ? comic.categories : []) ?? [];

  return (
    <div
      className="group cursor-pointer rounded-xl border border-border/60 bg-card overflow-hidden transition hover:shadow-md"
      onClick={() => onClick(comic)}
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-surface">
        {thumb ? (
          <img
            src={thumb.startsWith("http") ? thumb : `https://picaapi.picacomic.com/${thumb}`}
            alt={title}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <FileDown className="h-8 w-8" />
          </div>
        )}
        {isDownloaded && (
          <span className="absolute top-2 right-2 rounded-md bg-success/90 px-1.5 py-0.5 text-[10px] font-medium text-white">
            已下载
          </span>
        )}
        {mode === "rank" && "leaderboardCount" in comic && (
          <span className="absolute top-2 left-2 rounded-md bg-primary/90 px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
            #{comic.leaderboardCount}
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-1 text-sm font-medium leading-tight">{title}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{author}</p>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          {mode === "favorite" && <Heart className="h-3 w-3 text-rose-400" />}
          {mode === "rank" && <TrendingUp className="h-3 w-3 text-amber-400" />}
          {mode === "downloaded" && <FileDown className="h-3 w-3 text-emerald-400" />}
          <span>
            {likes > 0
              ? `${likes.toLocaleString()} 喜欢`
              : categories.slice(0, 2).join(" · ") || "漫画"}
          </span>
        </div>
      </div>
    </div>
  );
}
