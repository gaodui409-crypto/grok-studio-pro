import { z } from "zod";

const PICA_ID = "[A-Za-z0-9_-]+";
const PAGE = "[1-9][0-9]*";

const ALLOWED_PATHS = [
  /^auth\/sign-in$/,
  /^users\/profile$/,
  new RegExp(`^users/favourite\\?s=(?:dd|da)&page=${PAGE}$`),
  new RegExp(`^comics/advanced-search\\?page=${PAGE}$`),
  new RegExp(`^comics/${PICA_ID}$`),
  new RegExp(`^comics/${PICA_ID}/eps\\?page=${PAGE}$`),
  new RegExp(`^comics/${PICA_ID}/order/${PAGE}/pages\\?page=${PAGE}$`),
  /^comics\/leaderboard\?tt=(?:H24|D7|D30)&ct=VC$/,
];

export const MAX_IMAGE_RESPONSE_BYTES = 25 * 1024 * 1024;

export function isAllowedPicaPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0 || path.length > 256) return false;
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  if (normalized.includes("\\") || normalized.includes("..") || normalized.startsWith("/")) {
    return false;
  }
  return ALLOWED_PATHS.some((pattern) => pattern.test(normalized));
}

export function isAllowedPicaMethod(method: string, path: string): boolean {
  if (!isAllowedPicaPath(path)) return false;
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  const postOnly =
    normalized === "auth/sign-in" || normalized.startsWith("comics/advanced-search?");
  return postOnly ? method === "POST" : method === "GET";
}

export function isAllowedPicaImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "picacomic.com" ||
      hostname === "picaapi.picacomic.com" ||
      hostname.endsWith(".picacomic.com") ||
      hostname.endsWith(".picacomic.com.cn") ||
      /^storage[0-9]*(-pic)?\.(?:icu|com|net)$/.test(hostname)
    );
  } catch {
    return false;
  }
}

const loginBody = z
  .object({
    email: z.string().email().max(320),
    password: z.string().min(1).max(1024),
  })
  .strict();
const searchBody = z
  .object({
    keyword: z.string().min(1).max(2048),
    sort: z.enum(["dd", "da", "ld", "vd"]),
    categories: z.array(z.string().max(128)).max(32).optional(),
  })
  .strict();

export const picaApiRequestSchema = z
  .object({
    method: z.enum(["GET", "POST"]),
    path: z
      .string()
      .max(256)
      .transform((path) => path.replace(/^\//, "")),
    body: z.string().max(8192).nullable(),
    token: z
      .string()
      .min(1)
      .max(8192)
      .regex(/^[\x20-\x7e]+$/)
      .nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!isAllowedPicaMethod(data.method, data.path)) {
      ctx.addIssue({ code: "custom", path: ["path"], message: "不允许的 Pica API 路径或方法" });
      return;
    }
    if (data.method === "GET") {
      if (data.body !== null)
        ctx.addIssue({ code: "custom", path: ["body"], message: "GET 请求不能带正文" });
      return;
    }
    try {
      const schema = data.path === "auth/sign-in" ? loginBody : searchBody;
      if (data.body === null || !schema.safeParse(JSON.parse(data.body)).success) throw new Error();
    } catch {
      ctx.addIssue({ code: "custom", path: ["body"], message: "Pica 请求正文无效" });
    }
  });

export const picaImageRequestSchema = z
  .object({
    url: z.string().max(4096).refine(isAllowedPicaImageUrl, "不允许的 Pica 图片地址"),
  })
  .strict();

export function nextPicaImageUrl(current: string, location: string): string | null {
  try {
    const next = new URL(location, current).toString();
    return isAllowedPicaImageUrl(next) ? next : null;
  } catch {
    return null;
  }
}

export function limitedResponseBody(
  body: ReadableStream<Uint8Array> | null,
  limit = MAX_IMAGE_RESPONSE_BYTES,
  message = "图片响应过大",
): ReadableStream<Uint8Array> | null {
  if (!body) return null;
  let total = 0;
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        total += chunk.byteLength;
        if (total > limit) {
          controller.error(new Error(message));
          return;
        }
        controller.enqueue(chunk);
      },
    }),
  );
}
