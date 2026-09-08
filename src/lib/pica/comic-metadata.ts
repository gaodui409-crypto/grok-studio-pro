import { z } from "zod";
import type { Comic } from "./types.ts";

const id = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const text = z.string().default("");
const count = z.number().int().nonnegative().default(0);
const strings = z.array(z.string()).default([]);
const image = z.object({ originalName: text, path: z.string(), fileServer: z.string() });
const emptyImage = { originalName: "", path: "", fileServer: "" };

const comicMetadataSchema = z.object({
  _id: id,
  title: z.string().min(1),
  author: text,
  pagesCount: count,
  chapterInfos: z
    .array(
      z.object({
        _id: id,
        title: text,
        order: z.number().int().positive(),
        updatedAt: text,
        isDownloadeable: z.boolean().optional(),
      }),
    )
    .default([]),
  chapterCount: count,
  finished: z.boolean().default(false),
  categories: strings,
  thumb: image.default(emptyImage),
  likesCount: count,
  creator: z
    .object({
      id: text,
      gender: text,
      name: text,
      title: text,
      verified: z.boolean().nullable().default(null),
      exp: count,
      level: count,
      characters: strings,
      avatar: image.default(emptyImage),
      slogan: text,
      role: text,
      character: text,
    })
    .default({}),
  description: text,
  chineseTeam: text,
  tags: strings,
  updatedAt: text,
  createdAt: text,
  allowDownload: z.boolean().default(true),
  viewsCount: count,
  isLiked: z.boolean().default(false),
  commentsCount: count,
});

export function parseComicMetadata(input: unknown): Comic | null {
  const result = comicMetadataSchema.safeParse(input);
  return result.success ? result.data : null;
}
