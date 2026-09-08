import { create } from "zustand";
import type {
  Comic,
  ComicInSearch,
  ComicInFavorite,
  ComicInRank,
  UserProfileDetail,
  Pagination,
  DownloadTaskState,
  ProgressData,
  CurrentTabName,
  SearchSort,
  RankType,
  GetFavoriteSort,
  DownloadTaskEvent,
  DownloadAllFavoritesEvent,
  UpdateDownloadedComicsEvent,
  ChapterInfo,
} from "./types.ts";
import { attachChapterPage } from "./types.ts";
import { PicaClient, PicaApiError } from "./client.ts";
import { getDownloadManager, resetDownloadManager, type DownloadTask } from "./download-manager.ts";

const TOKEN_KEY = "pica-token";

function loadToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveToken(token: string) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export type PicaStore = {
  // Auth
  token: string;
  userProfile: UserProfileDetail | null;
  isLoggedIn: boolean;

  // Tabs
  currentTab: CurrentTabName;

  // Search
  searchKeyword: string;
  searchSort: SearchSort;
  searchCategories: string[];
  searchResult: Pagination<ComicInSearch> | null;
  searchPage: number;
  searchLoading: boolean;
  searchError: string | null;

  // Favorite
  favoriteSort: GetFavoriteSort;
  favoritePage: number;
  favoriteResult: Pagination<ComicInFavorite> | null;
  favoriteLoading: boolean;
  favoriteError: string | null;

  // Rank
  rankType: RankType;
  rankResult: ComicInRank[];
  rankLoading: boolean;
  rankError: string | null;

  // Downloaded
  downloadedComics: Comic[];
  downloadedLoading: boolean;
  downloadedError: string | null;

  // Chapter / detail
  pickedComic: Comic | null;
  pickedChapters: Pagination<ChapterInfo> | null;
  chapterLoading: boolean;
  chapterError: string | null;

  // Downloads
  progresses: Map<string, ProgressData>;
  downloadLoading: boolean;
  downloadError: string | null;

  // Bulk operations
  bulkLoading: string | null; // "favorites" | "update" | null
  bulkMessage: string | null;

  // Login form
  loginEmail: string;
  loginPassword: string;
  loginLoading: boolean;
  loginError: string | null;

  // Client (reactive)
  client: PicaClient;

  // Actions
  setToken: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setCurrentTab: (tab: CurrentTabName) => void;

  setSearchKeyword: (kw: string) => void;
  setSearchSort: (sort: SearchSort) => void;
  setSearchCategories: (cats: string[]) => void;
  search: () => Promise<void>;
  clearSearch: () => void;

  setFavoriteSort: (sort: GetFavoriteSort) => void;
  loadFavorites: () => Promise<void>;
  setRankType: (type: RankType) => void;
  loadRank: () => Promise<void>;
  loadDownloaded: () => Promise<void>;

  pickComic: (comic: Comic | null) => void;
  loadChapters: (comicId: string) => Promise<void>;
  clearChapters: () => void;

  downloadComic: (comic: Comic) => Promise<void>;
  downloadChapter: (comic: Comic, chapterId: string) => Promise<void>;
  pauseTask: (chapterId: string) => Promise<void>;
  resumeTask: (chapterId: string) => Promise<void>;
  cancelTask: (chapterId: string) => Promise<void>;
  downloadAllFavorites: () => Promise<void>;
  updateDownloadedComics: () => Promise<void>;

  setLoginEmail: (v: string) => void;
  setLoginPassword: (v: string) => void;
};

const client = new PicaClient();
client.setToken(loadToken());

export const usePicaStore = create<PicaStore>((set, get) => ({
  // Initial state
  token: loadToken(),
  userProfile: null,
  isLoggedIn: !!loadToken(),

  currentTab: "search",

  searchKeyword: "",
  searchSort: "dd",
  searchCategories: [],
  searchResult: null,
  searchPage: 1,
  searchLoading: false,
  searchError: null,

  favoriteSort: "dd",
  favoritePage: 1,
  favoriteResult: null,
  favoriteLoading: false,
  favoriteError: null,

  rankType: "H24",
  rankResult: [],
  rankLoading: false,
  rankError: null,

  downloadedComics: [],
  downloadedLoading: false,
  downloadedError: null,

  pickedComic: null,
  pickedChapters: null,
  chapterLoading: false,
  chapterError: null,

  progresses: new Map(),
  downloadLoading: false,
  downloadError: null,

  bulkLoading: null,
  bulkMessage: null,

  loginEmail: "",
  loginPassword: "",
  loginLoading: false,
  loginError: null,

  client,

  setToken: (token) => {
    saveToken(token);
    client.setToken(token);
    set({ token, isLoggedIn: !!token });
  },

  login: async (email, password) => {
    set({ loginLoading: true, loginError: null });
    try {
      const token = await client.login(email, password);
      get().setToken(token);
      const profile = await client.getUserProfile();
      set({ userProfile: profile, loginLoading: false });
    } catch (e) {
      const msg = e instanceof PicaApiError ? e.body : (e as Error).message;
      set({ loginError: msg, loginLoading: false });
    }
  },

  logout: () => {
    resetDownloadManager();
    saveToken("");
    client.setToken("");
    set({
      token: "",
      isLoggedIn: false,
      userProfile: null,
      searchResult: null,
      favoriteResult: null,
      rankResult: [],
      downloadedComics: [],
      pickedComic: null,
      pickedChapters: null,
      progresses: new Map(),
    });
  },

  setCurrentTab: (tab) => set({ currentTab: tab }),

  setSearchKeyword: (kw) => set({ searchKeyword: kw }),
  setSearchSort: (sort) => set({ searchSort: sort }),
  setSearchCategories: (cats) => set({ searchCategories: cats }),

  search: async () => {
    const { searchKeyword, searchSort, searchCategories, client } = get();
    if (!searchKeyword.trim()) return;
    if (!client.getToken()) {
      set({ searchError: "请先登录" });
      return;
    }
    set({ searchLoading: true, searchError: null, searchPage: 1, searchResult: null });
    try {
      const result = await client.searchComic(searchKeyword, searchSort, 1, searchCategories);
      set({ searchResult: result, searchLoading: false });
    } catch (e) {
      const msg = e instanceof PicaApiError ? e.body : (e as Error).message;
      set({ searchError: msg, searchLoading: false });
    }
  },

  clearSearch: () => set({ searchResult: null, searchKeyword: "" }),

  setFavoriteSort: (sort) => set({ favoriteSort: sort, favoritePage: 1, favoriteResult: null }),

  loadFavorites: async () => {
    const { favoriteSort, favoritePage, client } = get();
    if (!client.getToken()) return;
    set({ favoriteLoading: true, favoriteError: null });
    try {
      const result = await client.getFavorite(favoriteSort, favoritePage);
      set((s) => ({
        favoriteResult:
          s.favoritePage === 1
            ? { ...result, docs: result.docs ?? [] }
            : {
                ...result,
                docs: [...(s.favoriteResult?.docs ?? []), ...(result.docs ?? [])],
              },
        favoriteLoading: false,
      }));
    } catch (e) {
      const msg = e instanceof PicaApiError ? e.body : (e as Error).message;
      set({ favoriteError: msg, favoriteLoading: false });
    }
  },

  setRankType: (type) => set({ rankType: type, rankResult: [] }),

  loadRank: async () => {
    const { rankType, client } = get();
    set({ rankLoading: true, rankError: null });
    try {
      const result = await client.getRank(rankType);
      set({ rankResult: Array.isArray(result) ? result : [], rankLoading: false });
    } catch (e) {
      const msg = e instanceof PicaApiError ? e.body : (e as Error).message;
      set({ rankError: msg, rankLoading: false });
    }
  },

  loadDownloaded: async () => {
    set({ downloadedLoading: true, downloadedError: null });
    try {
      const dirHandle = await (
        window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }
      ).showDirectoryPicker();
      const comics = await client.getDownloadedComicsFromDir(dirHandle);
      set({ downloadedComics: comics, downloadedLoading: false });
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        set({ downloadedError: (e as Error).message });
      }
    } finally {
      set({ downloadedLoading: false });
    }
  },

  pickComic: (comic) =>
    set({ pickedComic: comic, pickedChapters: null, chapterLoading: false, chapterError: null }),

  loadChapters: async (comicId) => {
    const { client, pickedComic } = get();
    set({ chapterLoading: true, chapterError: null, pickedChapters: null });
    try {
      const chapters = await client.getAllChapters(comicId);
      if (get().pickedComic !== pickedComic) return;
      set({
        pickedChapters: chapters,
        pickedComic: pickedComic ? attachChapterPage(pickedComic, chapters) : pickedComic,
        chapterLoading: false,
      });
    } catch (e) {
      if (get().pickedComic !== pickedComic) return;
      const msg = e instanceof PicaApiError ? e.body : (e as Error).message;
      set({ chapterError: msg, chapterLoading: false });
    }
  },

  clearChapters: () => set({ pickedComic: null, pickedChapters: null, chapterLoading: false }),

  downloadComic: async (comic) => {
    const { client, pickedChapters, pickedComic } = get();
    set({ downloadLoading: true, downloadError: null });
    try {
      const chapters =
        (pickedComic?._id === comic._id ? pickedChapters : null) ??
        (await client.getAllChapters(comic._id));
      const comicWithChapters = attachChapterPage(comic, chapters);
      const dm = getDownloadManager(client);
      for (const ch of chapters.docs) {
        if (ch.isDownloadeable === false) continue;
        await dm.createTask(comicWithChapters, ch._id);
      }
      set({ downloadLoading: false });
    } catch (e) {
      const msg = e instanceof PicaApiError ? e.body : (e as Error).message;
      set({ downloadError: msg, downloadLoading: false });
      throw e;
    }
  },

  downloadChapter: async (comic, chapterId) => {
    const dm = getDownloadManager(get().client);
    await dm.createTask(comic, chapterId);
  },

  pauseTask: (chapterId) => {
    const dm = getDownloadManager(get().client);
    return dm.pauseTask(chapterId);
  },

  resumeTask: (chapterId) => {
    const dm = getDownloadManager(get().client);
    return dm.resumeTask(chapterId);
  },

  cancelTask: (chapterId) => {
    const dm = getDownloadManager(get().client);
    return dm.cancelTask(chapterId);
  },

  downloadAllFavorites: async () => {
    const { client } = get();
    set({ bulkLoading: "favorites", bulkMessage: "正在获取收藏夹…" });
    try {
      const firstPage = await client.getFavorite("dd", 1);
      const allComics = [...firstPage.docs];
      for (let p = 2; p <= firstPage.pages; p++) {
        const page = await client.getFavorite("dd", p);
        allComics.push(...page.docs);
      }
      set({ bulkMessage: `共 ${allComics.length} 部漫画，正在下载…` });
      const dm = getDownloadManager(client);
      for (const fav of allComics) {
        const comic = await client.getComic(fav._id);
        const chapters = await client.getAllChapters(comic._id);
        const comicWithChapters = attachChapterPage(comic, chapters);
        for (const ch of chapters.docs) {
          if (ch.isDownloadeable === false) continue;
          await dm.createTask(comicWithChapters, ch._id);
        }
      }
      set({ bulkLoading: null, bulkMessage: null });
    } catch (e) {
      const msg = e instanceof PicaApiError ? e.body : (e as Error).message;
      set({ bulkLoading: null, bulkMessage: `失败：${msg}` });
      setTimeout(() => set({ bulkMessage: null }), 3000);
    }
  },

  updateDownloadedComics: async () => {
    const { client } = get();
    set({ bulkLoading: "update", bulkMessage: "正在扫描已下载漫画…" });
    try {
      set({ bulkLoading: null, bulkMessage: null });
    } catch (e) {
      set({ bulkLoading: null, bulkMessage: null });
    }
  },

  setLoginEmail: (v) => set({ loginEmail: v }),
  setLoginPassword: (v) => set({ loginPassword: v }),
}));
