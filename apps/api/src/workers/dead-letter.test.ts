import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deadLetterPayload, shouldMoveToDeadLetter } from "./dead-letter";

describe("dead-letter queue", () => {
  it("moves a job only after retries are exhausted", () => {
    assert.equal(shouldMoveToDeadLetter(1, 5), false);
    assert.equal(shouldMoveToDeadLetter(5, 5), true);
    assert.equal(shouldMoveToDeadLetter(1, undefined), true);
  });

  it("records the source queue and failure reason for review", () => {
    assert.deepEqual(
      deadLetterPayload({
        sourceQueue: "extraction",
        jobName: "extract",
        data: { submissionId: "abc" },
        failedReason: "vision timeout",
        attemptsMade: 5,
      }),
      {
        sourceQueue: "extraction",
        jobName: "extract",
        data: { submissionId: "abc" },
        failedReason: "vision timeout",
        attemptsMade: 5,
      }
    );
  });
});
