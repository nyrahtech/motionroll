import type { OverlayBlendMode, OverlayMediaKind } from "../../../shared/src/index";

type OverlayMediaResolverInput = {
  src?: string | null;
  metadata?: unknown;
};

let plusLighterSupportCache: boolean | null = null;

function getMetadataKind(metadata: unknown): OverlayMediaKind | null {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const value = metadata as {
    kind?: unknown;
    mimeType?: unknown;
    contentType?: unknown;
  };

  if (value.kind === "image" || value.kind === "video") {
    return value.kind;
  }

  const mimeType =
    typeof value.mimeType === "string"
      ? value.mimeType
      : typeof value.contentType === "string"
        ? value.contentType
        : null;
  const normalizedMimeType = mimeType?.trim().toLowerCase() ?? "";

  if (normalizedMimeType.startsWith("video/")) {
    return "video";
  }

  if (normalizedMimeType.startsWith("image/")) {
    return "image";
  }

  return null;
}

function getExtensionKind(src: string | null | undefined): OverlayMediaKind {
  const normalized = src?.split("?")[0]?.split("#")[0]?.trim().toLowerCase() ?? "";
  return /\.(mp4|webm|mov|m4v)$/.test(normalized) ? "video" : "image";
}

export function resolveOverlayMediaKind(input: OverlayMediaResolverInput): OverlayMediaKind {
  return getMetadataKind(input.metadata) ?? getExtensionKind(input.src);
}

export function supportsPlusLighterBlendMode() {
  if (plusLighterSupportCache !== null) {
    return plusLighterSupportCache;
  }

  plusLighterSupportCache =
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("mix-blend-mode", "plus-lighter");

  return plusLighterSupportCache;
}

export function resolveOverlayBlendModeCssValue(blendMode: OverlayBlendMode | undefined) {
  switch (blendMode) {
    case "screen":
      return "screen";
    case "add":
      return supportsPlusLighterBlendMode() ? "plus-lighter" : "screen";
    default:
      return "normal";
  }
}

