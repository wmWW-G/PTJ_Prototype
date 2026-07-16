import { describe, expect, it, vi } from "vitest";
import { parseNdjsonStream } from "./api";
import type { GenerationStreamEvent } from "./liveTypes";

/** 把字符串片段包装为与 fetch 相同的 ReadableStream。 */
function streamFromChunks(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

describe("parseNdjsonStream", () => {
  it("处理被拆到多个网络 chunk 的同一行 JSON", async () => {
    const onEvent = vi.fn<(event: GenerationStreamEvent) => void>();
    await parseNdjsonStream(
      streamFromChunks([
        '{"type":"job_started","job_id":"job',
        '-1","status":"planning"}\n',
      ]),
      onEvent,
    );
    expect(onEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "job_started", job_id: "job-1" }),
    );
  });

  it("处理同一个 chunk 内的多条事件", async () => {
    const events: GenerationStreamEvent[] = [];
    await parseNdjsonStream(
      streamFromChunks([
        '{"type":"job_started","job_id":"j"}\n{"type":"job_completed","job_id":"j","status":"completed"}\n',
      ]),
      (event) => events.push(event),
    );
    expect(events.map((event) => event.type)).toEqual([
      "job_started",
      "job_completed",
    ]);
  });

  it("流结束时解析没有换行的最后一条事件", async () => {
    const events: GenerationStreamEvent[] = [];
    await parseNdjsonStream(
      streamFromChunks(['{"type":"job_completed","job_id":"j"}']),
      (event) => events.push(event),
    );
    expect(events).toHaveLength(1);
  });
});

