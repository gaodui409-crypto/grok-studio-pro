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
} from "./types";
import { picaApiRequest } from "./relay";

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

  private async request(method: string, path: string, body?: unknown): Promise<Response> {
    const result = await picaApiRequest({
      data: {
        method: method as "GET" | "POST",
        path,
        body: body === undefined ? null : JSON.stringify(body),
        token: this.token || null,
      },
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
    return data.data;
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

  async getChapterImages(
    comicId: string,
    chapterOrder: number,
    page: number,
  ): Promise<Pagination<ChapterImage>> {
    const resp = await this.request(
      "GET",
      `comics/${comicId}/order/${chapterOrder}/pages?page=${page}`,
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
    const firstPage = await this.getChapterImages(comicId, chapterOrder, 1);
    const totalPages = firstPage.pages;
    const pairs: [number, ChapterImage[]][] = [[1, firstPage.docs]];
    onProgress?.(1, totalPages);

    const promises: Promise<void>[] = [];
    for (let p = 2; p <= totalPages; p++) {
      const cid = comicId;
      const co = chapterOrder;
      const sig = signal;
      promises.push(
        this.getChapterImages(cid, co, p).then((res) => {
          pairs.push([p, res.docs]);
          onProgress?.(p, totalPages);
        }),
      );
    }
    await Promise.all(promises);
    pairs.sort((a, b) => a[0] - b[0]);
    const urls: string[] = [];
    for (const [, imgs] of pairs) {
      for (const img of imgs) {
        urls.push(`${img.media.fileServer}/static/${img.media.path}`);
      }
    }
    return urls;
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
    return data.data;
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
    const iter = (
      dirHandle as unknown as { [Symbol.asyncIterator](): AsyncIterator<FileSystemHandle> }
    )[Symbol.asyncIterator]();
    let result = await iter.next();
    while (!result.done) {
      const entry = result.value;
      if (entry.kind === "file") {
        const fileHandle = entry as FileSystemFileHandle;
        try {
          const file = await fileHandle.getFile();
          const text = await file.text();
          const comic = JSON.parse(text) as Comic;
          comics.push(comic);
        } catch {
          // skip invalid metadata files
        }
      }
      result = await iter.next();
    }
    return comics;
  }
}
