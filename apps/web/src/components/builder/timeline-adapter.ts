import { normalizeTimingRange, progressToSeconds, secondsToProgress } from "@motionroll/shared";
import { TIMELINE_MIN_WIDTH, type TimelineSelection, type TimelineTrackModel } from "./timeline-model";

export type TimelineAction = {
  id: string;
  start: number;
  end: number;
  effectId: string;
  selected?: boolean;
  movable?: boolean;
  flexible?: boolean;
  minStart?: number;
  maxEnd?: number;
};

export type TimelineEffect = {
  id: string;
  name: string;
};

export type TimelineRow = {
  id: string;
  rowHeight: number;
  selected?: boolean;
  classNames?: string[];
  actions: TimelineAction[];
};

export type MotionRollTimelineAction = TimelineAction & {
  effectId: "section" | "layer";
};

export const motionRollTimelineEffects: Record<string, TimelineEffect> = {
  section: { id: "section", name: "Section" },
  layer: { id: "layer", name: "Layer" },
};

export function createTimelineRows(
  tracks: TimelineTrackModel[],
  selection: TimelineSelection,
  durationSeconds: number,
): TimelineRow[] {
  return tracks.map((track) => ({
    id: track.id,
    rowHeight: 40,
    selected: selection?.trackType === track.type,
    classNames: [`motionroll-row-${track.type}`],
    actions: track.clips.map((clip) => ({
      id: clip.id,
      start: progressToSeconds(clip.start, durationSeconds),
      end: progressToSeconds(clip.end, durationSeconds),
      effectId: track.type,
      selected: selection?.clipId === clip.id,
      movable: true,
      flexible: true,
      minStart: 0,
      maxEnd: durationSeconds,
    })),
  }));
}

export function getClipTimingFromAction(
  action: Pick<TimelineAction, "start" | "end">,
  durationSeconds: number,
) {
  return normalizeTimingRange(
    {
      start: secondsToProgress(action.start, durationSeconds),
      end: secondsToProgress(action.end, durationSeconds),
    },
    TIMELINE_MIN_WIDTH,
  );
}

export function getChangedTimelineActions(
  rows: TimelineRow[],
  tracks: TimelineTrackModel[],
  durationSeconds: number,
) {
  const currentActionMap = new Map(
    tracks.flatMap((track) =>
      track.clips.map((clip) => [
        clip.id,
        {
          start: clip.start,
          end: clip.end,
        },
      ]),
    ),
  );

  return rows.flatMap((row) =>
    row.actions.flatMap((action) => {
      const current = currentActionMap.get(action.id);
      if (!current) {
        return [];
      }

      const nextTiming = getClipTimingFromAction(action, durationSeconds);
      if (current.start === nextTiming.start && current.end === nextTiming.end) {
        return [];
      }

      return [{ clipId: action.id, timing: nextTiming }];
    }),
  );
}
