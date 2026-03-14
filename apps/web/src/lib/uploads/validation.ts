import path from "node:path";
import { env } from "@/lib/env";

const acceptedVideoMimeTypes = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);

const acceptedVideoExtensions = new Map([
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".webm", "video/webm"],
  [".m4v", "video/x-m4v"],
]);

export function normalizeUploadFilename(input: string) {
  const trimmed = input.trim();
  const parsed = path.parse(trimmed);
  const extension = parsed.ext.toLowerCase();
  const baseName = parsed.name.toLowerCase();
  const safeBase = baseName.replace(/[^a-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

  if (!safeBase || !acceptedVideoExtensions.has(extension)) {
    throw new Error("Upload must use a supported video filename and extension.");
  }

  return `${safeBase.slice(0, 80)}${extension}`;
}

export function validateVideoUpload(input: {
  filename: string;
  contentType: string;
  bytes: number;
}) {
  const filename = normalizeUploadFilename(input.filename);
  const extension = path.extname(filename).toLowerCase();
  const expectedMimeType = acceptedVideoExtensions.get(extension);

  if (!expectedMimeType) {
    throw new Error("Unsupported video extension.");
  }

  if (input.bytes <= 0 || input.bytes > env.UPLOAD_MAX_VIDEO_BYTES) {
    throw new Error(
      `Video upload must be between 1 byte and ${env.UPLOAD_MAX_VIDEO_BYTES} bytes.`,
    );
  }

  const normalizedContentType = input.contentType.trim().toLowerCase();
  const contentTypeLooksValid = acceptedVideoMimeTypes.has(normalizedContentType);

  if (!contentTypeLooksValid && normalizedContentType !== "application/octet-stream") {
    throw new Error("Unsupported video content type.");
  }

  if (
    normalizedContentType !== "application/octet-stream" &&
    normalizedContentType !== expectedMimeType
  ) {
    throw new Error("Video filename extension does not match content type.");
  }

  return {
    filename,
    contentType: normalizedContentType === "application/octet-stream" ? expectedMimeType : normalizedContentType,
    bytes: input.bytes,
  };
}

export { acceptedVideoExtensions, acceptedVideoMimeTypes };
