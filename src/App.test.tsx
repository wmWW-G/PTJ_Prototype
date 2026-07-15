import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("默认展示批量文生图工作区", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "批量文生图" })).toBeInTheDocument();
  });
});
