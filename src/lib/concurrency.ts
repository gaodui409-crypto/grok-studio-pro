// Run an async worker over a list with bounded concurrency.
export async function runWithConcurrency<T>(
  items: T[],
  worker: (item: T, idx: number) => Promise<void>,
  concurrency = 3,
) {
  let cursor = 0;
  const run = async () => {
    while (cursor < items.length) {
      const my = cursor++;
      await worker(items[my], my);
    }
  };
  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, run));
}
