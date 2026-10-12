/**
 * Photo submissions against real Mongo and a REAL BullMQ queue (Redis) —
 * a faked queue once hid that BullMQ rejects ":" in job ids, which broke
 * every upload. Object storage is faked.
 *
 *   pnpm --filter api build && pnpm --filter api test:integration
 */
import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Queue } from "bullmq";
import mongoose, { Types } from "mongoose";
import {
  TEST_REDIS_URL,
  connectTestDb,
  dropTestDb,
} from "../common/integration-db";
import {
  Submission,
  SubmissionSchema,
} from "../database/schemas/submission.schema";
import { JobQueuesService } from "../workers/job-queues.service";
import {
  QUEUE_DLQ,
  QUEUE_EXTRACTION,
  QUEUE_NOTIFICATION,
  QUEUE_PROMOTE,
} from "../workers/queue-names";
import { bullmqConnection } from "../workers/redis-connection";
import { SubmissionsService } from "./submissions.service";

class FakeStorage {
  stored = new Set<string>();
  async putLabelPhoto(key: string): Promise<void> {
    this.stored.add(key);
  }
  async deleteLabelPhoto(key: string): Promise<void> {
    this.stored.delete(key);
  }
}

describe("photo submissions (integration)", () => {
  // Own key prefix, so test jobs never mix with a local worker's queues.
  const connection = bullmqConnection(TEST_REDIS_URL);
  const queue = (name: string) =>
    new Queue(name, { connection, prefix: "itest-submissions" });
  const queues = [
    QUEUE_EXTRACTION,
    QUEUE_NOTIFICATION,
    QUEUE_PROMOTE,
    QUEUE_DLQ,
  ].map(queue);
  const [extraction] = queues;
  const jobQueues = new JobQueuesService(
    ...(queues as [Queue, Queue, Queue, Queue])
  );

  const submissions = mongoose.model(Submission.name, SubmissionSchema);
  const storage = new FakeStorage();
  const service = new SubmissionsService(
    submissions as never,
    storage as never,
    jobQueues
  );

  let seq = 0;
  const photos = (count: number) => {
    seq += 1;
    return Array.from({ length: count }, (_, i) => ({
      buffer: Buffer.from(`photo ${seq}-${i}`),
      mimetype: "image/jpeg",
      originalname: `frame${i}.jpg`,
    }));
  };
  const user = () => new Types.ObjectId().toHexString();

  before(async () => {
    await connectTestDb("foodscanner_test_submissions");
    await Promise.all(queues.map((q) => q.obliterate({ force: true })));
  });

  after(async () => {
    await Promise.all(queues.map((q) => q.obliterate({ force: true })));
    await Promise.all(queues.map((q) => q.close()));
    await dropTestDb();
  });

  it("queues a real extraction job for an upload of 5 video frames", async () => {
    const { submission_id } = await service.create(
      "8900000000201",
      user(),
      photos(5)
    );
    const job = await extraction.getJob(`extract-${submission_id}`);
    assert.ok(job, "extraction job exists in Redis");
    assert.deepEqual(job.data, { submissionId: submission_id });
  });

  it("returns the same submission for a double tap, with one job", async () => {
    const userId = user();
    const same = photos(3);
    const first = await service.create("8900000000202", userId, same);
    const second = await service.create("8900000000202", userId, same);
    assert.equal(second.submission_id, first.submission_id);
    assert.equal(
      await submissions.countDocuments({ barcode: "8900000000202" }),
      1
    );
  });

  it("leaves nothing behind when queueing fails, so a retry starts fresh", async () => {
    const userId = user();
    const same = photos(3);
    const brokenQueue = {
      getJob: async () => undefined,
      add: async () => {
        throw new Error("Redis unavailable");
      },
    };
    const failing = new SubmissionsService(
      submissions as never,
      storage as never,
      new JobQueuesService(
        brokenQueue as never,
        ...(queues.slice(1) as [Queue, Queue, Queue])
      )
    );
    const photosBefore = storage.stored.size;

    await assert.rejects(
      failing.create("8900000000203", userId, same),
      /Redis unavailable/
    );
    assert.equal(
      await submissions.countDocuments({ barcode: "8900000000203" }),
      0
    );
    assert.equal(storage.stored.size, photosBefore, "its photos are removed");

    // The same photos now go through, instead of being deduped to a dead one.
    const { submission_id } = await service.create(
      "8900000000203",
      userId,
      same
    );
    assert.ok(await extraction.getJob(`extract-${submission_id}`));
  });
});
