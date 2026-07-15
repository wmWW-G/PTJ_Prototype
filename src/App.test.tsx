import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("默认展示批量文生图工作区", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "批量文生图" })).toBeInTheDocument();
  });

  it("使用 Hash 路由兼容 GitHub Pages 子路径刷新", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: "批量图生图" })).toHaveAttribute(
      "href",
      "#/image-to-image",
    );
  });
});
