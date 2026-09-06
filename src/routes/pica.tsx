import { useCallback, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, Download, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { LoginDialog } from "@/components/pica/login-dialog";
import { SearchPane } from "@/components/pica/search-pane";
import { FavoritePane } from "@/components/pica/favorite-pane";
import { RankPane } from "@/components/pica/rank-pane";
import { DownloadedPane } from "@/components/pica/downloaded-pane";
import { ChapterPane } from "@/components/pica/chapter-pane";
import { DownloadPane } from "@/components/pica/download-pane";
import { usePicaStore } from "@/lib/pica/store";
import type { Comic, ComicInSearch, ComicInFavorite, ComicInRank } from "@/lib/pica/types";

export const Route = createFileRoute("/pica")({
  head: () => ({
    meta: [
      { title: "漫画下载 — Grok Studio" },
      { name: "description", content: "PicaComic 漫画搜索与批量下载。" },
    ],
  }),
  component: PicaPage,
});

function PicaPage() {
  const {
    isLoggedIn,
    userProfile,
    currentTab,
    setCurrentTab,
    pickedComic,
    pickComic,
    clearChapters,
  } = usePicaStore();

  const [showChapter, setShowChapter] = useState(false);

  const normalizeComic = useCallback(
    (raw: ComicInSearch | ComicInFavorite | ComicInRank): Comic => {
      const isSearch = (raw as ComicInSearch).totalLikes !== undefined;
      const isRank = (raw as ComicInRank).leaderboardCount !== undefined;
      let title = "";
      let author = "";
      let pagesCount = 0;
      let chapterCount = 0;
      let finished = false;
      let categories: string[] = [];
      let thumb: Comic["thumb"] = { originalName: "", path: "", fileServer: "" };
      let likesCount = 0;
      let description = "";
      let chineseTeam = "";
      let tags: string[] = [];
      let updatedAt = "";

      if (isSearch) {
        const c = raw as ComicInSearch;
        title = c.title;
        author = c.author;
        pagesCount = c.pagesCount ?? 0;
        chapterCount = c.chapterCount ?? 0;
        finished = c.finished;
        categories = c.categories;
        thumb = { ...c.thumb, fileServer: c.thumb.fileServer };
        likesCount = c.likesCount;
        description = c.description;
        chineseTeam = c.chineseTeam;
        tags = c.tags ?? [];
        updatedAt = c.updatedAt;
      } else if (isRank) {
        const c = raw as ComicInRank;
        title = c.title;
        author = c.author;
        pagesCount = c.pagesCount;
        chapterCount = c.epsCount;
        finished = c.finished;
        categories = c.categories;
        tags = c.tags ?? [];
        thumb = { ...c.thumb, fileServer: c.thumb.fileServer };
        likesCount = c.likesCount;
      } else {
        const c = raw as ComicInFavorite;
        title = c.title;
        author = c.author;
        pagesCount = c.pagesCount;
        chapterCount = c.epsCount;
        finished = c.finished;
        categories = c.categories;
      }
      return {
        _id: raw._id,
        title,
        author,
        pagesCount,
        chapterInfos: [],
        chapterCount,
        finished,
        categories,
        thumb,
        likesCount,
        creator: {
          id: "",
          gender: "",
          name: author,
          title: "",
          verified: null,
          exp: 0,
          level: 0,
          characters: [],
          avatar: { originalName: "", path: "", fileServer: "" },
          slogan: "",
          role: "",
          character: "",
        },
        description,
        chineseTeam,
        tags,
        updatedAt,
        createdAt: updatedAt,
        allowDownload: true,
        viewsCount: 0,
        isLiked: false,
        commentsCount: 0,
      };
    },
    [],
  );

  const handlePickComic = useCallback(
    (raw: unknown) => {
      const comic = normalizeComic(raw as ComicInSearch | ComicInFavorite | ComicInRank);
      pickComic(comic);
      setShowChapter(true);
    },
    [normalizeComic, pickComic],
  );

  const handleBackFromChapter = useCallback(() => {
    setShowChapter(false);
    clearChapters();
  }, [clearChapters]);

  if (!isLoggedIn) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
        <PageHeader
          title="漫画下载"
          description="登录 PicaComic 账号后即可搜索和下载漫画。"
          icon={BookOpen}
        />
        <div className="mt-8 flex flex-col items-center justify-center gap-4 rounded-2xl border border-border/60 bg-card p-8 text-center">
          <Download className="h-10 w-10 text-primary/40" />
          <h2 className="font-display text-lg font-semibold">登录以使用漫画下载</h2>
          <p className="max-w-md text-sm text-muted-foreground">
            使用 PicaComic 账号登录后，可以搜索漫画、查看收藏夹和排行榜，并批量下载漫画章节。
          </p>
          <LoginDialog>
            <Button>
              <LogIn className="mr-2 h-4 w-4" /> 登录 PicaComic
            </Button>
          </LoginDialog>
        </div>
      </div>
    );
  }

  if (showChapter && pickedComic) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
        <PageHeader
          title={pickedComic.title}
          description={`${pickedComic.author} · ${pickedComic.chapterCount} 章节`}
          icon={BookOpen}
        />
        <div className="mt-2">
          <ChapterPane comic={pickedComic} onBack={handleBackFromChapter} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1500px] px-4 py-8 md:px-8">
      <div className="mb-6 flex items-center justify-between">
        <PageHeader
          title="漫画下载"
          description={
            userProfile
              ? `搜索、收藏与批量下载漫画。欢迎，${userProfile.name}！`
              : "搜索、收藏与批量下载漫画。"
          }
          icon={BookOpen}
        />
        <LoginDialog>
          <Button variant="ghost" size="sm">
            {userProfile?.name} · Lv.{userProfile?.level}
          </Button>
        </LoginDialog>
      </div>

      <Tabs value={currentTab} onValueChange={(v) => setCurrentTab(v as typeof currentTab)}>
        <TabsList className="grid w-full max-w-2xl grid-cols-5">
          <TabsTrigger value="search">搜索</TabsTrigger>
          <TabsTrigger value="favorite">收藏</TabsTrigger>
          <TabsTrigger value="rank">排行榜</TabsTrigger>
          <TabsTrigger value="downloaded">已下载</TabsTrigger>
          <TabsTrigger value="chapter">下载队列</TabsTrigger>
        </TabsList>

        <div className="mt-5">
          <TabsContent value="search" forceMount className="data-[state=inactive]:hidden">
            <SearchPane onPickComic={handlePickComic} />
          </TabsContent>
          <TabsContent value="favorite" forceMount className="data-[state=inactive]:hidden">
            <FavoritePane onPickComic={handlePickComic} />
          </TabsContent>
          <TabsContent value="rank" forceMount className="data-[state=inactive]:hidden">
            <RankPane onPickComic={handlePickComic} />
          </TabsContent>
          <TabsContent value="downloaded" forceMount className="data-[state=inactive]:hidden">
            <DownloadedPane onPickComic={handlePickComic} />
          </TabsContent>
          <TabsContent value="chapter" forceMount className="data-[state=inactive]:hidden">
            <DownloadPane />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
