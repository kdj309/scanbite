import type { ClientSession, Connection } from "mongoose";

/**
 * Dev/single-node Mongo has no replica set, so multi-document transactions
 * aren't available — this falls back to running the same operation without
 * a session rather than hard-failing account creation/promotion locally.
 * Production must run a replica set: without one, a crash mid-fallback-run
 * can leave a partial write (e.g. user created but its default household
 * member not yet saved) with no transaction to roll it back.
 */
function isTransactionUnsupported(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("Transaction numbers are only allowed") ||
    message.includes("replica set")
  );
}

export async function withTransactionFallback<T>(
  connection: Connection,
  fn: (session?: ClientSession) => Promise<T>
): Promise<T> {
  const session = await connection.startSession();
  try {
    session.startTransaction();
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction().catch(() => undefined);
    if (isTransactionUnsupported(error)) {
      return fn(undefined);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
