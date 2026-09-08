import type {
  SearchSort,
  RankType,
  GetFavoriteSort,
  UserProfileDetail,
  Pagination,
  Comic,
  ComicInSearch,
  ChapterInfo,
  ChapterImage,
  ComicInFavorite,
  ComicInRank,
} from "./types.ts";
import { picaMediaUrl } from "./types.ts";
import { picaApiRequest } from "./relay.ts";
import { parseComicMetadata } from "./comic-metadata.ts";

export class PicaApiError extends Error {
  status: number;
  body: string;
  picaCode?: number;
  constructor(status: number, body: string, picaCode?: number) {
    super(`PicaComic API error (${status}): ${body}`);
    this.status = status;
    this.body = body;
    this.picaCode = picaCode;
  }
}

export class PicaClient {
  private token = "";

  setToken(token: string) {
    this.token = token;
  }

  getToken() {
    return this.token;
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    signal?: AbortSignal,
  ): Promise<Response> {
    const result = await picaApiRequest({
      data: {
        method: method as "GET" | "POST",
        path,
        body: body === undefined ? null : JSON.stringify(body),
        token: this.token || null,
      },
      signal,
    });
    return new Response(result.body, { status: result.status });
  }

  async login(email: string, password: string): Promise<string> {
    const resp = await this.request("POST", "auth/sign-in", { email, password });
    if (resp.status === 400) {
      const text = await resp.text();
      throw new PicaApiError(400, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data in login response");
    this.token = data.data.token;
    return this.token;
  }

  async getUserProfile(): Promise<UserProfileDetail> {
    const resp = await this.request("GET", "users/profile");
    if (resp.status === 401) {
      const text = await resp.text();
      throw new PicaApiError(401, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data");
    return data.data.user;
  }

  async searchComic(
    keyword: string,
    sort: SearchSort,
    page: number,
    categories: string[] = [],
  ): Promise<Pagination<ComicInSearch>> {
    // 现行接口只接受 keyword + sort（categories 有值时才携带）
    const body: Record<string, unknown> = { keyword, sort };
    if (categories.length > 0) body.categories = categories;
    const resp = await this.request("POST", `comics/advanced-search?page=${page}`, body);
    if (resp.status === 401) {
      const text = await resp.text();
      throw new PicaApiError(401, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data");
    return data.data.comics;
  }

  async getComic(comicId: string): Promise<Comic> {
    const resp = await this.request("GET", `comics/${comicId}`);
    if (resp.status === 401) {
      const text = await resp.text();
      throw new PicaApiError(401, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data");
    return data.data.comic;
  }

  async getChapters(comicId: string, page = 1): Promise<Pagination<ChapterInfo>> {
    const resp = await this.request("GET", `comics/${comicId}/eps?page=${page}`);
    if (resp.status === 401) {
      const text = await resp.text();
      throw new PicaApiError(401, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data");
    return data.data.eps;
  }

  async getAllChapters(comicId: string): Promise<Pagination<ChapterInfo>> {
    const first = await this.getChapters(comicId, 1);
    const docs = [...first.docs];
    for (let page = 2; page <= first.pages; page += 1) {
      const next = await this.getChapters(comicId, page);
      docs.push(...next.docs);
    }
    return { ...first, docs, page: 1, pages: 1, total: first.total || docs.length };
  }

  async getChapterImages(
    comicId: string,
    chapterOrder: number,
    page: number,
    signal?: AbortSignal,
  ): Promise<Pagination<ChapterImage>> {
    const resp = await this.request(
      "GET",
      `comics/${comicId}/order/${chapterOrder}/pages?page=${page}`,
      undefined,
      signal,
    );
    if (resp.status === 401) {
      const text = await resp.text();
      throw new PicaApiError(401, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data");
    return data.data.pages;
  }

  async getAllChapterImageUrls(
    comicId: string,
    chapterOrder: number,
    onProgress?: (fetched: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<string[]> {
    const pages = await this.getAllChapterImages(comicId, chapterOrder, onProgress, signal);
    const urls: string[] = [];
    for (const img of pages) {
      urls.push(picaMediaUrl(img.media));
    }
    return urls;
  }

  async getAllChapterImages(
    comicId: string,
    chapterOrder: number,
    onProgress?: (fetched: number, total: number) => void,
    signal?: AbortSignal,
  ): Promise<ChapterImage[]> {
    signal?.throwIfAborted();
    const firstPage = await this.getChapterImages(comicId, chapterOrder, 1, signal);
    const totalPages = firstPage.pages;
    const pages: ChapterImage[] = [...firstPage.docs];
    onProgress?.(1, totalPages);
    for (let page = 2; page <= totalPages; page += 1) {
      signal?.throwIfAborted();
      const next = await this.getChapterImages(comicId, chapterOrder, page, signal);
      pages.push(...next.docs);
      onProgress?.(page, totalPages);
    }
    return pages;
  }

  async getFavorite(sort: GetFavoriteSort, page: number): Promise<Pagination<ComicInFavorite>> {
    const resp = await this.request("GET", `users/favourite?s=${sort}&page=${page}`);
    if (resp.status === 401) {
      const text = await resp.text();
      throw new PicaApiError(401, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data");
    return data.data.comics;
  }

  async getRank(rankType: RankType): Promise<ComicInRank[]> {
    const resp = await this.request("GET", `comics/leaderboard?tt=${rankType}&ct=VC`);
    if (resp.status === 401) {
      const text = await resp.text();
      throw new PicaApiError(401, text);
    }
    if (resp.status !== 200) {
      const text = await resp.text();
      throw new PicaApiError(resp.status, text);
    }
    const data = await resp.json();
    if (data.code !== 200) throw new PicaApiError(resp.status, JSON.stringify(data), data.code);
    if (!data.data) throw new PicaApiError(resp.status, "Missing data");
    // 排行榜返回的是 data.comics（不是 docs）
    return data.data.comics ?? [];
  }

  async getDownloadedComicsFromDir(dirHandle: FileSystemDirectoryHandle): Promise<Comic[]> {
    const comics: Comic[] = [];
    const walk = async (directory: FileSystemDirectoryHandle): Promise<void> => {
      const iter = (directory as unknown as { values(): AsyncIterator<FileSystemHandle> }).values();
      let result = await iter.next();
      while (!result.done) {
        const entry = result.value;
        if (entry.kind === "directory") {
          await walk(entry as FileSystemDirectoryHandle);
        } else if (entry.kind === "file" && entry.name.toLowerCase() === "comic.json") {
          try {
            const file = await (entry as FileSystemFileHandle).getFile();
            const comic = parseComicMetadata(JSON.parse(await file.text()));
            if (comic) comics.push(comic);
          } catch {
            // skip invalid metadata files
          }
        }
        result = await iter.next();
      }
    };
    await walk(dirHandle);
    return comics;
  }
}
