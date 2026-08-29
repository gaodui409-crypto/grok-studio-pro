export type PersistenceResult = { saved: true } | { saved: false; error: Error };

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export async function attemptPersistence(save: () => Promise<unknown>): Promise<PersistenceResult> {
  try {
    await save();
    return { saved: true };
  } catch (error) {
    return { saved: false, error: asError(error) };
  }
}
