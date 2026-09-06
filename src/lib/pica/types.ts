// 排序/榜单取值为哔咔现行 API 的参数（旧值 LikeMost/Day 等已失效，返回 1002 校验错误）
export type SearchSort = "dd" | "da" | "ld" | "vd";
export type RankType = "H24" | "D7" | "D30";
export type GetFavoriteSort = "dd" | "da";
export type DownloadTaskState =
  | "Pending"
  | "Downloading"
  | "Paused"
  | "Cancelled"
  | "Completed"
  | "Failed";
export type DownloadTask = {
  chapterId: string;
  comic: Comic;
  chapterInfo: ChapterInfo;
  state: DownloadTaskState;
  downloadedImgCount: number;
  totalImgCount: number;
  abortController: AbortController;
  startedAt: number;
};
export type CurrentTabName = "search" | "favorite" | "rank" | "downloaded" | "chapter";

export type ImageRespData = { originalName: string; path: string; fileServer: string };
export type Image = { originalName: string; path: string; fileServer: string };
export type ChapterImage = { _id: string; media: ImageRespData };
export type ChapterInfo = {
  _id: string;
  title: string;
  order: number;
  updatedAt: string;
  images?: { total: number; pages: number; docs: ChapterImage[] };
  isDownloadeable?: boolean;
};
export type Creator = {
  id: string;
  gender: string;
  name: string;
  title: string;
  verified: boolean | null;
  exp: number;
  level: number;
  characters: string[];
  avatar: Image;
  slogan: string;
  role: string;
  character: string;
};
export type Comic = {
  _id: string;
  title: string;
  author: string;
  pagesCount: number;
  chapterInfos: ChapterInfo[];
  chapterCount: number;
  finished: boolean;
  categories: string[];
  thumb: Image;
  likesCount: number;
  creator: Creator;
  description: string;
  chineseTeam: string;
  tags: string[];
  updatedAt: string;
  createdAt: string;
  allowDownload: boolean;
  viewsCount: number;
  isLiked: boolean;
  commentsCount: number;
};
export type ComicInSearch = {
  _id: string;
  author: string;
  categories: string[];
  chineseTeam: string;
  createdAt: string;
  description: string;
  finished: boolean;
  likesCount: number;
  tags: string[];
  thumb: ImageRespData;
  title: string;
  totalLikes: number | null;
  totalViews: number | null;
  updatedAt: string;
  isDownloaded: boolean;
  comicDownloadDir: string;
  pagesCount?: number;
  chapterCount?: number;
};
export type ComicInFavorite = {
  _id: string;
  title: string;
  author: string;
  pagesCount: number;
  epsCount: number;
  finished: boolean;
  categories: string[];
  thumb: ImageRespData;
  likesCount: number;
  isDownloaded: boolean;
  comicDownloadDir: string;
  tags?: string[];
};
export type ComicInRank = {
  _id: string;
  title: string;
  author: string;
  pagesCount: number;
  epsCount: number;
  finished: boolean;
  categories: string[];
  tags: string[];
  thumb: ImageRespData;
  likesCount: number;
  totalViews: number;
  totalLikes: number;
  viewsCount: number;
  leaderboardCount: number;
};
export type UserProfileDetail = {
  _id: string;
  gender: string;
  name: string;
  title: string;
  verified: boolean;
  exp: number;
  level: number;
  characters: string[];
  avatar?: ImageRespData;
  birthday: string;
  email: string;
  created_at: string;
  isPunched: boolean;
};
export type Pagination<T> = {
  total: number;
  limit: number;
  page: number;
  pages: number;
  docs: T[];
};
export type PicaResp<T = unknown> = {
  code: number;
  message: string;
  data: T;
  status: string;
};
export type DownloadTaskEvent =
  | {
      event: "Create";
      data: {
        state: DownloadTaskState;
        comic: Comic;
        chapterInfo: ChapterInfo;
        downloadedImgCount: number;
        totalImgCount: number;
      };
    }
  | {
      event: "Update";
      data: {
        chapterId: string;
        state: DownloadTaskState;
        downloadedImgCount: number;
        totalImgCount: number;
      };
    };
export type DownloadAllFavoritesEvent =
  | { event: "GettingFavorites" }
  | { event: "GettingComics"; data: { current: number; total: number } }
  | { event: "EndGetComics" }
  | {
      event: "StartCreateDownloadTasks";
      data: { comicId: string; comicTitle: string; current: number; total: number };
    }
  | { event: "CreatingDownloadTask"; data: { comicId: string; current: number } }
  | { event: "EndCreateDownloadTasks"; data: { comicId: string } };
export type UpdateDownloadedComicsEvent =
  | { event: "GetComicStart"; data: { total: number } }
  | { event: "GetComicProgress"; data: { current: number; total: number } }
  | {
      event: "CreateDownloadTasksStart";
      data: { comicId: string; comicTitle: string; current: number; total: number };
    }
  | { event: "CreateDownloadTaskProgress"; data: { comicId: string; current: number } }
  | { event: "CreateDownloadTasksEnd"; data: { comicId: string } }
  | { event: "GetComicEnd" };
export type ProgressData = Extract<DownloadTaskEvent, { event: "Create" }>["data"] & {
  percentage: number;
  indicator: string;
};
