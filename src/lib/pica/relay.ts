// Browsers cannot override User-Agent, so Pica requests are signed on the server.
import { createServerFn } from "@tanstack/react-start";
import { picaApiRequestSchema, picaImageRequestSchema } from "./relay-security.ts";
import { relayPicaApi, relayPicaImage, type OutboundInit } from "./relay-transport.ts";

export type { PicaApiResult, PicaApiRequestArgs } from "./relay-transport.ts";

async function outboundFetch(url: string, init: OutboundInit): Promise<Response> {
  // Development may need a local proxy; Workers use their native fetch.
  if (import.meta.env.DEV && typeof process !== "undefined" && process.versions?.node) {
    try {
      const [{ getDevDispatcher }, { fetch: undiciFetch }] = await Promise.all([
        import("./dev-dispatcher"),
        import("undici"),
      ]);
      const dispatcher = await getDevDispatcher();
      return undiciFetch(url, { ...init, dispatcher }) as unknown as Response;
    } catch (error) {
      console.warn("[pica] 本地代理不可用，改为直连 picaapi", error);
    }
  }
  return fetch(url, init);
}

export const picaApiRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => picaApiRequestSchema.parse(input))
  .handler(({ data }) => relayPicaApi(data, outboundFetch));

export const picaImageFetch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => picaImageRequestSchema.parse(input))
  .handler(({ data }) => relayPicaImage(data.url, outboundFetch));
