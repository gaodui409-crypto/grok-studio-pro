/** Error raised after one or more batch items succeeded before a later item failed. */
export class PartialBatchError<T> extends Error {
  readonly results: T[];
  readonly failedIndex: number;
  readonly cause: Error;

  constructor(results: T[], failedIndex: number, cause: unknown) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    super(
      `批量生成部分成功：已得到 ${results.length} 项；第 ${failedIndex + 1} 项失败：${error.message}`,
    );
    this.name = "PartialBatchError";
    this.results = results;
    this.failedIndex = failedIndex;
    this.cause = error;
  }
}

/** Run a count-sized batch in order while preserving results before a failure. */
export async function runSequentialBatch<T>(
  count: number,
  worker: (index: number) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];
  for (let index = 0; index < count; index += 1) {
    try {
      results.push(await worker(index));
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (results.length === 0) throw error;
      throw new PartialBatchError(results, index, error);
    }
  }
  return results;
}
import { isAbortError } from "./http.ts";
