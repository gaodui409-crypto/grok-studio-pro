import { assertResponseOk } from "../http.ts";
import { loadSettings } from "../settings.ts";

export async function xaiRequest<T>(
  path: string,
  init: RequestInit,
  settings = loadSettings(),
): Promise<T> {
  const { apiKey, baseUrl } = settings;
  if (!apiKey) throw new Error("请先在设置中配置 API Key");

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  await assertResponseOk(response);
  return response.json();
}
