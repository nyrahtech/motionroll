import { describe, expect, it } from "vitest";
import { normalizeUploadFilename, validateVideoUpload } from "./validation";

describe("normalizeUploadFilename", () => {
  it("normalizes supported video filenames safely", () => {
    expect(normalizeUploadFilename("  Launch Cut 01.MP4  ")).toBe("launch-cut-01.mp4");
  });

  it("rejects unsupported non-video extensions", () => {
    expect(() => normalizeUploadFilename("frames.zip")).toThrow(
      "Upload must use a supported video filename and extension.",
    );
  });
});

describe("validateVideoUpload", () => {
  it("accepts a supported video upload", () => {
    expect(
      validateVideoUpload({
        filename: "Launch Reel.mov",
        contentType: "video/quicktime",
        bytes: 1024,
      }),
    ).toMatchObject({
      filename: "launch-reel.mov",
      contentType: "video/quicktime",
      bytes: 1024,
    });
  });

  it("rejects unsupported content types", () => {
    expect(() =>
      validateVideoUpload({
        filename: "launch.mp4",
        contentType: "image/png",
        bytes: 1024,
      }),
    ).toThrow("Unsupported video content type.");
  });

  it("rejects mismatched filename and content type pairs", () => {
    expect(() =>
      validateVideoUpload({
        filename: "launch.mp4",
        contentType: "video/quicktime",
        bytes: 1024,
      }),
    ).toThrow("Video filename extension does not match content type.");
  });

  it("rejects uploads above the configured size limit", () => {
    expect(() =>
      validateVideoUpload({
        filename: "launch.mp4",
        contentType: "video/mp4",
        bytes: 600_000_000,
      }),
    ).toThrow("Video upload must be between 1 byte and");
  });

  it("rejects empty video uploads", () => {
    expect(() =>
      validateVideoUpload({
        filename: "launch.mp4",
        contentType: "video/mp4",
        bytes: 0,
      }),
    ).toThrow("Video upload must be between 1 byte and");
  });

  it("accepts octet-stream when the filename is still a supported video", () => {
    expect(
      validateVideoUpload({
        filename: "launch.mp4",
        contentType: "application/octet-stream",
        bytes: 2048,
      }),
    ).toMatchObject({
      filename: "launch.mp4",
      contentType: "video/mp4",
    });
  });
});
