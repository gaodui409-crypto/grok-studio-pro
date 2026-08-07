export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function messageFromParsedJson(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const data = value as { error?: unknown; message?: unknown };
  if (data.error && typeof data.error === "object") {
    const nested = data.error as { message?: unknown };
    if (typeof nested.message === "string" && nested.message) return nested.message;
  }
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.message === "string" && data.message) return data.message;
  return null;
}

export async function responseErrorMessage(response: Response): Promise<string> {
  const fallback = `HTTP ${response.status}`;
  const text = await response.text().catch(() => "");
  if (!text) return fallback;
  try {
    return messageFromParsedJson(JSON.parse(text)) || text;
  } catch {
    return text;
  }
}

export async function assertResponseOk(response: Response, prefix = ""): Promise<Response> {
  if (response.ok) return response;
  const message = await responseErrorMessage(response);
  throw new Error(prefix ? `${prefix}: ${message}` : message);
}

export async function fetchBlobChecked(
  url: string,
  fetchImpl: FetchLike = fetch,
): Promise<Blob> {
  const response = await fetchImpl(url);
  await assertResponseOk(response);
  return response.blob();
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
