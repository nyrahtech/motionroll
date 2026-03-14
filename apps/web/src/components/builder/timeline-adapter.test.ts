import { describe, expect, it } from "vitest";
import {
  createTimelineRows,
  getChangedTimelineActions,
  getClipTimingFromAction,
} from "./timeline-adapter";
import type { TimelineSelection, TimelineTrackModel } from "./timeline-model";

const tracks: TimelineTrackModel[] = [
  {
    id: "track-section",
    label: "Section",
    type: "section",
    clips: [
      {
        id: "section-range",
        trackType: "section",
        label: "Section",
        start: 0,
        end: 1,
      },
    ],
  },
  {
    id: "track-overlay",
    label: "Text",
    type: "overlay",
    clips: [
      {
        id: "overlay-intro",
        trackType: "overlay",
        label: "Intro",
        start: 0.2,
        end: 0.4,
        metadata: { overlayId: "intro" },
      },
    ],
  },
];

describe("timeline adapter", () => {
  it("maps MotionRoll tracks into timeline-editor rows", () => {
    const selection: TimelineSelection = { clipId: "overlay-intro", trackType: "overlay" };
    const rows = createTimelineRows(tracks, selection, 10);

    expect(rows).toHaveLength(2);
    expect(rows[1]?.actions[0]).toMatchObject({
      id: "overlay-intro",
      start: 2,
      end: 4,
      selected: true,
    });
  });

  it("maps edited actions back into normalized MotionRoll timings", () => {
    expect(getClipTimingFromAction({ start: 2, end: 4 }, 10)).toEqual({
      start: 0.2,
      end: 0.4,
    });
  });

  it("reports only changed actions when rows are edited", () => {
    const rows = createTimelineRows(tracks, null, 10);
    rows[1]!.actions[0] = { ...rows[1]!.actions[0]!, start: 3, end: 5 };

    expect(getChangedTimelineActions(rows, tracks, 10)).toEqual([
      {
        clipId: "overlay-intro",
        timing: {
          start: 0.3,
          end: 0.5,
        },
      },
    ]);
  });
});
