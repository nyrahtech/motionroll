import { describe, expect, it } from "vitest";
import { createScrollSection } from "../src";

describe("runtime exports", () => {
  it("exports the public runtime entrypoint", () => {
    expect(typeof createScrollSection).toBe("function");
  });
});
