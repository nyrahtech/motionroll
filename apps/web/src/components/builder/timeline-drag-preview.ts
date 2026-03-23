import type { TimelineClipModel } from "./timeline-model";

export type LayerRowGeometry = {
  trackIndex: number;
  top: number;
  bottom: number;
  height: number;
};

type DragContainerRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function resolveLayerTrackIndexFromPointer(
  clientY: number,
  layerRows: LayerRowGeometry[],
) {
  if (!Number.isFinite(clientY) || layerRows.length === 0) {
    return null;
  }

  const containingRow = layerRows.find((row) => clientY >= row.top && clientY <= row.bottom);
  if (containingRow) {
    return containingRow.trackIndex;
  }

  return layerRows.reduce((nearestRow, row) => {
    const nearestCenter = (nearestRow.top + nearestRow.bottom) / 2;
    const rowCenter = (row.top + row.bottom) / 2;
    return Math.abs(clientY - rowCenter) < Math.abs(clientY - nearestCenter) ? row : nearestRow;
  }).trackIndex;
}

export function getClipInsertionIndex(
  targetStart: number,
  clips: Pick<TimelineClipModel, "id" | "start">[],
  draggedClipId: string,
) {
  const sortedClips = clips
    .filter((clip) => clip.id !== draggedClipId)
    .sort((left, right) => left.start - right.start);

  const nextIndex = sortedClips.findIndex((clip) => targetStart < clip.start);
  return nextIndex === -1 ? sortedClips.length : nextIndex;
}

export function getLayerDragGhostPosition(params: {
  clientX: number;
  clientY: number;
  containerRect: DragContainerRect;
  scrollLeft: number;
  scrollTop: number;
  pointerOffsetX: number;
  pointerOffsetY: number;
  ghostWidth: number;
  ghostHeight: number;
}) {
  const {
    clientX,
    clientY,
    containerRect,
    scrollLeft,
    scrollTop,
    pointerOffsetX,
    pointerOffsetY,
    ghostWidth,
    ghostHeight,
  } = params;

  const localLeft = clientX - containerRect.left + scrollLeft - pointerOffsetX;
  const localTop = clientY - containerRect.top + scrollTop - pointerOffsetY;
  const minLeft = scrollLeft;
  const maxLeft = scrollLeft + Math.max(0, containerRect.width - ghostWidth);
  const minTop = scrollTop;
  const maxTop = scrollTop + Math.max(0, containerRect.height - ghostHeight);

  return {
    left: clamp(localLeft, minLeft, maxLeft),
    top: clamp(localTop, minTop, maxTop),
  };
}
