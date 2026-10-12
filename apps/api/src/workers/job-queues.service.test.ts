import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { JobQueuesService, dedupeJobId } from "./job-queues.service";

/** A stand-in BullMQ queue that records add() calls. */
function fakeQueue() {
  const added: Array<{ name: string; opts: { jobId?: string } }> = [];
  return {
    added,
    getJob: async () => undefined,
    add: async (name: string, _data: unknown, opts: { jobId?: string }) => {
      added.push({ name, opts });
    },
  };
}

describe("JobQueuesService job ids", () => {
  it("never uses ':' (BullMQ rejects it in custom ids)", async () => {
    const extraction = fakeQueue();
    const promote = fakeQueue();
    const queues = new JobQueuesService(
      extraction as never,
      fakeQueue() as never,
      promote as never,
      fakeQueue() as never
    );

    await queues.enqueueExtraction("6ab7d04ffb5027914b128aed");
    await queues.enqueuePromote({
      submissionId: "6ab7d04ffb5027914b128aed",
      productVersionId: "6ab7d04ffb5027914b128aee",
    });

    const ids = [...extraction.added, ...promote.added].map(
      (j) => j.opts.jobId
    );
    assert.deepEqual(ids, [
      "extract-6ab7d04ffb5027914b128aed",
      "promote-6ab7d04ffb5027914b128aed-6ab7d04ffb5027914b128aee",
    ]);
    assert.ok(ids.every((id) => !id?.includes(":")));
  });

  it("joins parts with '-'", () => {
    assert.equal(dedupeJobId("a", "b", "c"), "a-b-c");
  });
});
