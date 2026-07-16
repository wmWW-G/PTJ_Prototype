import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LiveResultsPanel } from "./LiveResultsPanel";
import type { LiveGenerationState } from "../liveTypes";

describe("LiveResultsPanel", () => {
  it("逐张展示槽位角色、状态、尺寸和重试次数", () => {
    const state: LiveGenerationState = {
      jobId: "job-1",
      status: "generating",
      resultImages: ["https://blob.example/1.png"],
      completedCount: 1,
      failedCount: 0,
      variants: {
        1: {
          index: 1,
          status: "generating",
          images: {
            1: {
              index: 1,
              role: "main_image",
              title: "企业总览",
              status: "completed",
              imageUrl: "https://blob.example/1.png",
              actualSize: "2048x2048",
              elapsedMs: 41000,
              retryCount: 1,
            },
          },
        },
      },
    };

    render(<LiveResultsPanel state={state} expectedCount={6} />);

    expect(screen.getByText("企业总览")).toBeInTheDocument();
    expect(screen.getByText("2048x2048")).toBeInTheDocument();
    expect(screen.getByText(/重试 1 次/)).toBeInTheDocument();
    expect(screen.getByText("1 / 6")).toBeInTheDocument();
  });
});
