import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCustomTemplateImageRequest,
  generateCustomTemplateImage,
  parseNdjsonStream,
} from "./api";
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

describe("自定义模板单图生图", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("始终使用 GPT-Image-2、低质量和单张主图模板", () => {
    const referenceAsset = {
      url: "https://assets.example.com/cap.jpg",
      mime_type: "image/jpeg" as const,
      filename: "cap.jpg",
    };

    expect(buildCustomTemplateImageRequest("  保留帽子，增加四种 Logo 工艺  ", referenceAsset)).toEqual({
      image_type: "main",
      template_id: "main_01",
      visual_template_id: "standard_product",
      model: "gpt_image_2_openrouter",
      aspect_ratio: "1:1",
      resolution: "1K",
      quality: "low",
      language: "zh-CN",
      variant_count: 1,
      user_requirement: "保留帽子，增加四种 Logo 工艺",
      supplemental_info: {},
      reference_assets: [referenceAsset],
    });
  });

  it("先上传用户附图，再从真实事件流返回生成图片", async () => {
    const stream = streamFromChunks([
      '{"type":"job_started","job_id":"job-custom"}\n',
      '{"type":"anchor_completed","job_id":"job-custom","image_url":"https://images.example.com/result.png"}\n',
      '{"type":"job_completed","job_id":"job-custom","status":"completed"}\n',
    ]);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        url: "https://assets.example.com/cap.jpg",
        mime_type: "image/jpeg",
        filename: "cap.jpg",
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const referenceFile = new File(["cap"], "cap.jpg", { type: "image/jpeg" });
    await expect(generateCustomTemplateImage({
      instruction: "生成更清晰的 Logo 工艺展示",
      referenceFile,
    })).resolves.toBe("https://images.example.com/result.png");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const generationInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
    expect(JSON.parse(String(generationInit.body))).toEqual(expect.objectContaining({
      model: "gpt_image_2_openrouter",
      resolution: "1K",
      quality: "low",
      reference_assets: [expect.objectContaining({ filename: "cap.jpg" })],
    }));
  });

  it("收到成图事件后立即返回，不等待整个事件流关闭", async () => {
    const encoder = new TextEncoder();
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const openStream = new ReadableStream<Uint8Array>({
      start(controller) {
        streamController = controller;
        controller.enqueue(encoder.encode(
          '{"type":"anchor_completed","job_id":"job-fast","image_url":"https://images.example.com/fast.png"}\n',
        ));
        // 故意保持流为打开状态，模拟后端仍在发送任务收尾事件。
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(openStream, {
      status: 200,
      headers: { "Content-Type": "application/x-ndjson" },
    })));

    const resultPromise = generateCustomTemplateImage({ instruction: "生成商品主图" });
    try {
      const firstOutcome = await Promise.race([
        resultPromise,
        new Promise<string>((resolve) => setTimeout(() => resolve("still-waiting"), 30)),
      ]);
      expect(firstOutcome).toBe("https://images.example.com/fast.png");
    } finally {
      streamController?.close();
      await resultPromise;
    }
  });
});
