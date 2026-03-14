import { describe, expect, it } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
  it("creates a URL-safe slug", () => {
    expect(slugify("MotionRoll Product Reveal 2026")).toBe(
      "motionroll-product-reveal-2026",
    );
  });
});
