import { describe, expect, it } from "vitest";
import { demoProjectMap, demoProjects, featuredDemoProject } from "./demo-projects";

describe("demo project definitions", () => {
  it("keeps Ocean Depth first for the library hero", () => {
    expect(featuredDemoProject?.id).toBe("ocean-depth");
    expect(featuredDemoProject?.title).toBe("Ocean Depth");
    expect(featuredDemoProject?.starter.presetId).toBe("scroll-sequence");
  });

  it("stores the four static demo definitions with local thumbnails and preset starters", () => {
    expect(demoProjects).toHaveLength(4);
    expect(demoProjects[0]?.thumbnailUrl).toBe("/library-demos/ocean-depth.jpg");
    expect(demoProjectMap.get("product-reveal")?.starter.presetId).toBe("product-reveal");
    expect(demoProjectMap.get("product-spin")?.starter.presetId).toBe("device-spin");
    expect(demoProjectMap.get("editorial-story")?.starter.presetId).toBe("chaptered-scroll-story");
  });
});
