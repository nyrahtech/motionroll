import { z } from "zod";
import { SourceTypeSchema } from "./assets";
import { OverlayDefinitionSchema } from "./overlays";

export const PresetIdSchema = z.enum([
  "scroll-sequence",
  "product-reveal",
  "feature-walkthrough",
  "before-after",
  "device-spin",
  "chaptered-scroll-story",
]);
export type PresetId = z.infer<typeof PresetIdSchema>;

export const ControlTypeSchema = z.enum([
  "slider",
  "toggle",
  "select",
  "text",
  "textarea",
  "range",
]);
export type ControlType = z.infer<typeof ControlTypeSchema>;

export const PresetControlSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: ControlTypeSchema,
  group: z.enum(["common", "preset", "advanced"]),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  description: z.string().optional(),
});
export type PresetControl = z.infer<typeof PresetControlSchema>;

function joinTextParts(parts: Array<string | undefined>) {
  const values = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return values.length > 0 ? values.join("\n\n") : "";
}

const CommonSectionTextSchema = z
  .object({
    content: z.string().default("").optional(),
    kicker: z.string().default("").optional(),
    headline: z.string().default("").optional(),
    body: z.string().default("").optional(),
  })
  .transform((text) => ({
    content:
      text.content?.trim() ??
      joinTextParts([text.kicker, text.headline, text.body]),
  }));

export const CommonSectionSettingsSchema = z.object({
  sectionHeightVh: z.number().min(100).max(600),
  scrubStrength: z.number().min(0.05).max(4),
  frameRange: z.object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
  }),
  fallbackBehavior: z.object({
    mobile: z.enum(["poster", "video", "sequence"]),
    reducedMotion: z.enum(["poster", "video", "sequence"]),
  }),
  motion: z.object({
    easing: z.enum(["linear", "power2.out", "power3.out"]),
    pin: z.boolean(),
    preloadWindow: z.number().int().min(2).max(40),
  }),
  text: CommonSectionTextSchema,
  cta: z.object({
    label: z.string().default(""),
    href: z.string().default(""),
  }),
});
export type CommonSectionSettings = z.infer<typeof CommonSectionSettingsSchema>;

export const PresetSpecificConfigSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
);
export type PresetSpecificConfig = z.infer<typeof PresetSpecificConfigSchema>;

export const PresetDefaultsSchema = z.object({
  common: CommonSectionSettingsSchema,
  preset: PresetSpecificConfigSchema,
});
export type PresetDefaults = z.infer<typeof PresetDefaultsSchema>;

export const PresetDefinitionSchema = z.object({
  id: PresetIdSchema,
  label: z.string().min(1),
  description: z.string().min(1),
  supportedSourceTypes: z.array(SourceTypeSchema).min(1),
  previewThumbnail: z.string().min(1),
  defaults: PresetDefaultsSchema,
  exposedControls: z.array(PresetControlSchema).min(1),
  advancedControls: z.array(PresetControlSchema),
  seededOverlays: z.array(OverlayDefinitionSchema).min(1),
});
export type PresetDefinition = z.infer<typeof PresetDefinitionSchema>;

const commonControls: PresetControl[] = [
  {
    id: "sectionHeightVh",
    label: "Section Height",
    type: "slider",
    group: "common",
    min: 140,
    max: 420,
    step: 10,
    description: "Controls the scroll distance allocated to the cinematic section.",
  },
  {
    id: "scrubStrength",
    label: "Scrub",
    type: "slider",
    group: "common",
    min: 0.1,
    max: 2,
    step: 0.05,
  },
  {
    id: "frameRange",
    label: "Frame Range",
    type: "range",
    group: "common",
    description: "Trim the playable frame window without touching source assets.",
  },
  {
    id: "fallbackBehavior.mobile",
    label: "Mobile Fallback",
    type: "select",
    group: "common",
    options: [
      { label: "Poster", value: "poster" },
      { label: "Video", value: "video" },
      { label: "Sequence", value: "sequence" },
    ],
  },
  {
    id: "fallbackBehavior.reducedMotion",
    label: "Reduced Motion",
    type: "select",
    group: "common",
    options: [
      { label: "Poster", value: "poster" },
      { label: "Video", value: "video" },
      { label: "Sequence", value: "sequence" },
    ],
  },
  {
    id: "text.content",
    label: "Text",
    type: "textarea",
    group: "common",
  },
  {
    id: "cta.label",
    label: "CTA Label",
    type: "text",
    group: "common",
  },
];

const advancedControls: PresetControl[] = [
  {
    id: "motion.pin",
    label: "Pin Section",
    type: "toggle",
    group: "advanced",
  },
  {
    id: "motion.preloadWindow",
    label: "Preload Window",
    type: "slider",
    group: "advanced",
    min: 4,
    max: 24,
    step: 1,
  },
  {
    id: "motion.easing",
    label: "Easing",
    type: "select",
    group: "advanced",
    options: [
      { label: "Linear", value: "linear" },
      { label: "Power 2", value: "power2.out" },
      { label: "Power 3", value: "power3.out" },
    ],
  },
];

const baseCommonDefaults = {
  sectionHeightVh: 240,
  scrubStrength: 1,
  frameRange: {
    start: 0,
    end: 179,
  },
  fallbackBehavior: {
    mobile: "video" as const,
    reducedMotion: "poster" as const,
  },
  motion: {
    easing: "linear" as const,
    pin: true,
    preloadWindow: 8,
  },
  text: {
    content: "",
  },
  cta: {
    label: "",
    href: "",
  },
};

const presetDefinitionInputs = [
  {
    id: "scroll-sequence",
    label: "Scroll Sequence",
    description:
      "A clean scroll-scrubbed image sequence for cinematic product or scene reveals.",
    supportedSourceTypes: ["video", "ai_clip"],
    previewThumbnail: "/thumbnails/scroll-sequence.png",
    defaults: {
      common: {
        ...baseCommonDefaults,
        sectionHeightVh: 260,
        text: {
          kicker: "Launch film",
          headline: "A polished sequence that moves exactly with scroll.",
          body: "Use a single cinematic clip and let the runtime map progress to frames with no guesswork.",
        },
        cta: {
          label: "View details",
          href: "#details",
        },
      },
      preset: {
        overlayStyle: "floating-card",
        captionPosition: "left",
        introOpacity: 0.9,
      },
    },
    exposedControls: [
      ...commonControls,
      {
        id: "overlayStyle",
        label: "Overlay Style",
        type: "select",
        group: "preset",
        options: [
          { label: "Floating Card", value: "floating-card" },
          { label: "Minimal", value: "minimal" },
          { label: "Full Bleed", value: "full-bleed" },
        ],
      },
      {
        id: "captionPosition",
        label: "Caption Position",
        type: "select",
        group: "preset",
        options: [
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" },
        ],
      },
    ],
    advancedControls,
    seededOverlays: [
      {
        id: "overlay-intro",
        timing: { start: 0.06, end: 0.24 },
        content: {
          eyebrow: "Precision",
          headline: "Match every scroll tick to a frame.",
          body: "A tight image-sequence experience with a soft intro card and a premium poster fallback.",
          cta: { label: "Preview runtime", href: "#preview" },
          align: "start",
          theme: "light",
          treatment: "default",
        },
      },
      {
        id: "overlay-close",
        timing: { start: 0.6, end: 0.82 },
        content: {
          eyebrow: "Continuity",
          headline: "Keep the motion readable on every screen.",
          body: "Fallback video and reduced-motion behavior are configured from the same manifest.",
          align: "end",
          theme: "accent",
          treatment: "default",
        },
      },
    ],
  },
  {
    id: "product-reveal",
    label: "Product Reveal",
    description:
      "Lead with a hero product turntable, then sequence feature callouts as the object settles.",
    supportedSourceTypes: ["video", "ai_clip"],
    previewThumbnail: "/thumbnails/product-reveal.png",
    defaults: {
      common: {
        ...baseCommonDefaults,
        sectionHeightVh: 300,
        scrubStrength: 0.85,
        text: {
          kicker: "Product launch",
          headline: "Reveal the hero object before the details land.",
          body: "Start with motion, then let the copy arrive in measured, premium beats.",
        },
        cta: {
          label: "Book a demo",
          href: "#demo",
        },
      },
      preset: {
        revealAxis: "y",
        spotlightStrength: 0.7,
        featureCardStyle: "stacked",
      },
    },
    exposedControls: [
      ...commonControls,
      {
        id: "revealAxis",
        label: "Reveal Axis",
        type: "select",
        group: "preset",
        options: [
          { label: "Vertical", value: "y" },
          { label: "Horizontal", value: "x" },
        ],
      },
      {
        id: "spotlightStrength",
        label: "Spotlight",
        type: "slider",
        group: "preset",
        min: 0,
        max: 1,
        step: 0.05,
      },
    ],
    advancedControls,
    seededOverlays: [
      {
        id: "overlay-hero",
        timing: { start: 0.08, end: 0.26 },
        content: {
          eyebrow: "New hardware",
          headline: "A reveal built for the first three seconds.",
          body: "Pull attention to the object with a bold opener before feature cards take over.",
          align: "start",
          theme: "dark",
          treatment: "default",
        },
      },
      {
        id: "overlay-feature",
        timing: { start: 0.38, end: 0.58 },
        content: {
          eyebrow: "Feature one",
          headline: "Show the detail exactly when the frame earns it.",
          body: "Preset metadata keeps only the relevant controls visible in the Editor.",
          align: "center",
          theme: "accent",
          treatment: "default",
        },
      },
      {
        id: "overlay-cta",
        timing: { start: 0.72, end: 0.9 },
        content: {
          headline: "Ship a hosted embed when the sequence is ready.",
          body: "Publishing stays manifest-first so your runtime and editor remain in sync.",
          cta: { label: "Open publish", href: "#publish" },
          align: "end",
          theme: "light",
          treatment: "default",
        },
      },
    ],
  },
  {
    id: "feature-walkthrough",
    label: "Feature Walkthrough",
    description:
      "A guided tour through a UI or workflow where each scroll beat activates a focused talking point.",
    supportedSourceTypes: ["video", "ai_clip"],
    previewThumbnail: "/thumbnails/feature-walkthrough.png",
    defaults: {
      common: {
        ...baseCommonDefaults,
        sectionHeightVh: 340,
        text: {
          kicker: "Product education",
          headline: "Walk through three key moments without turning into a slideshow.",
          body: "This preset favors readable overlays, tighter pacing, and generous section height.",
        },
        cta: {
          label: "See workflow",
          href: "#workflow",
        },
      },
      preset: {
        stepCount: 3,
        focusRing: true,
        calloutLayout: "right-rail",
      },
    },
    exposedControls: [
      ...commonControls,
      {
        id: "stepCount",
        label: "Step Count",
        type: "slider",
        group: "preset",
        min: 2,
        max: 5,
        step: 1,
      },
      {
        id: "focusRing",
        label: "Focus Ring",
        type: "toggle",
        group: "preset",
      },
    ],
    advancedControls,
    seededOverlays: [
      {
        id: "overlay-step-1",
        timing: { start: 0.05, end: 0.22 },
        content: {
          eyebrow: "Step 1",
          headline: "Introduce the workflow before the user loses context.",
          body: "Use the opening third to orient the viewer and frame the value clearly.",
          align: "start",
          theme: "light",
          treatment: "default",
        },
      },
      {
        id: "overlay-step-2",
        timing: { start: 0.28, end: 0.48 },
        content: {
          eyebrow: "Step 2",
          headline: "Bring attention to the active UI region.",
          body: "Focus rings and callout layouts are preset-specific controls, not generic Editor noise.",
          align: "end",
          theme: "accent",
          treatment: "default",
        },
      },
      {
        id: "overlay-step-3",
        timing: { start: 0.58, end: 0.82 },
        content: {
          eyebrow: "Step 3",
          headline: "End on outcome, not on interface chrome.",
          body: "A final overlay closes the story and hands off to the next action cleanly.",
          cta: { label: "Open Editor", href: "#editor" },
          align: "start",
          theme: "dark",
          treatment: "default",
        },
      },
    ],
  },
  {
    id: "before-after",
    label: "Before / After",
    description:
      "Pair a transformation narrative with synchronized overlays that explain the change over time.",
    supportedSourceTypes: ["video", "ai_clip"],
    previewThumbnail: "/thumbnails/before-after.png",
    defaults: {
      common: {
        ...baseCommonDefaults,
        sectionHeightVh: 220,
        scrubStrength: 1.1,
        text: {
          kicker: "Transformation",
          headline: "Make the comparison obvious without relying on a draggable slider.",
          body: "Scroll drives the transition, while overlays reinforce what changed and why it matters.",
        },
        cta: {
          label: "Compare specs",
          href: "#compare",
        },
      },
      preset: {
        dividerStyle: "soft",
        contrastBoost: 0.2,
        labelsVisible: true,
      },
    },
    exposedControls: [
      ...commonControls,
      {
        id: "dividerStyle",
        label: "Divider Style",
        type: "select",
        group: "preset",
        options: [
          { label: "Soft", value: "soft" },
          { label: "Sharp", value: "sharp" },
        ],
      },
      {
        id: "labelsVisible",
        label: "Show Labels",
        type: "toggle",
        group: "preset",
      },
    ],
    advancedControls,
    seededOverlays: [
      {
        id: "overlay-before",
        timing: { start: 0.04, end: 0.25 },
        content: {
          eyebrow: "Before",
          headline: "Ground the viewer in the starting state.",
          body: "Open with the baseline experience so the transformation has weight.",
          align: "start",
          theme: "dark",
          treatment: "default",
        },
      },
      {
        id: "overlay-transition",
        timing: { start: 0.35, end: 0.58 },
        content: {
          eyebrow: "Transition",
          headline: "Use the mid-sequence to narrate the shift.",
          body: "This preset works well for product upgrades, renovation stories, and visual comparisons.",
          align: "center",
          theme: "accent",
          treatment: "default",
        },
      },
      {
        id: "overlay-after",
        timing: { start: 0.68, end: 0.88 },
        content: {
          eyebrow: "After",
          headline: "Land on the improved state with a stronger CTA.",
          body: "Keep the final message concise so the visual difference does the heavy lifting.",
          cta: { label: "See result", href: "#result" },
          align: "end",
          theme: "light",
          treatment: "default",
        },
      },
    ],
  },
  {
    id: "device-spin",
    label: "Device Spin",
    description:
      "A controlled 360-style showcase for hardware and industrial design moments.",
    supportedSourceTypes: ["video", "ai_clip"],
    previewThumbnail: "/thumbnails/device-spin.png",
    defaults: {
      common: {
        ...baseCommonDefaults,
        sectionHeightVh: 250,
        scrubStrength: 0.95,
        text: {
          kicker: "Industrial design",
          headline: "Spin the device with stable, deterministic frame mapping.",
          body: "Designed for turntable captures and clean product rotations that need premium fallback behavior.",
        },
        cta: {
          label: "Inspect hardware",
          href: "#hardware",
        },
      },
      preset: {
        spinDirection: "clockwise",
        highlightEdge: true,
        backgroundTreatment: "studio",
      },
    },
    exposedControls: [
      ...commonControls,
      {
        id: "spinDirection",
        label: "Spin Direction",
        type: "select",
        group: "preset",
        options: [
          { label: "Clockwise", value: "clockwise" },
          { label: "Counter Clockwise", value: "counter-clockwise" },
        ],
      },
      {
        id: "highlightEdge",
        label: "Highlight Edge",
        type: "toggle",
        group: "preset",
      },
    ],
    advancedControls,
    seededOverlays: [
      {
        id: "overlay-spin-1",
        timing: { start: 0.06, end: 0.22 },
        content: {
          eyebrow: "Rotation",
          headline: "Lead with the silhouette and let the spin settle into detail.",
          body: "This preset favors balanced pacing and generous preloading for sharper playback.",
          align: "start",
          theme: "light",
          treatment: "default",
        },
      },
      {
        id: "overlay-spin-2",
        timing: { start: 0.5, end: 0.72 },
        content: {
          eyebrow: "Craft",
          headline: "Bring material and edge details forward mid-spin.",
          body: "Perfect for hardware launches, accessories, and premium packaging showcases.",
          align: "end",
          theme: "dark",
          treatment: "default",
        },
      },
    ],
  },
  {
    id: "chaptered-scroll-story",
    label: "Chaptered Scroll Story",
    description:
      "A longer-form narrative arc that uses chapter overlays to guide the viewer through a cinematic sequence.",
    supportedSourceTypes: ["video", "ai_clip"],
    previewThumbnail: "/thumbnails/chaptered-scroll-story.png",
    defaults: {
      common: {
        ...baseCommonDefaults,
        sectionHeightVh: 420,
        scrubStrength: 0.7,
        text: {
          kicker: "Narrative mode",
          headline: "Tell a longer story without losing the discipline of a single section.",
          body: "Chapter overlays, pinned motion, and a slower scrub create room for narrative pacing.",
        },
        cta: {
          label: "Read chapters",
          href: "#chapters",
        },
      },
      preset: {
        chapterCount: 4,
        chapterNav: true,
        ambientTint: "warm",
      },
    },
    exposedControls: [
      ...commonControls,
      {
        id: "chapterCount",
        label: "Chapters",
        type: "slider",
        group: "preset",
        min: 3,
        max: 6,
        step: 1,
      },
      {
        id: "chapterNav",
        label: "Chapter Nav",
        type: "toggle",
        group: "preset",
      },
    ],
    advancedControls,
    seededOverlays: [
      {
        id: "chapter-1",
        timing: { start: 0.03, end: 0.18 },
        content: {
          eyebrow: "Chapter 01",
          headline: "Set the world and its visual tone immediately.",
          body: "The opening chapter should make the viewer feel the sequence is intentionally paced.",
          align: "start",
          theme: "accent",
          treatment: "default",
        },
      },
      {
        id: "chapter-2",
        timing: { start: 0.24, end: 0.4 },
        content: {
          eyebrow: "Chapter 02",
          headline: "Introduce the conflict or key product tension.",
          body: "This is where longer-form preset copy can carry more context without overcrowding the frame.",
          align: "end",
          theme: "light",
          treatment: "default",
        },
      },
      {
        id: "chapter-3",
        timing: { start: 0.48, end: 0.66 },
        content: {
          eyebrow: "Chapter 03",
          headline: "Resolve the tension with the visual payoff.",
          body: "Use the center stretch for the most cinematic sequence moment and strongest message.",
          align: "start",
          theme: "dark",
          treatment: "default",
        },
      },
      {
        id: "chapter-4",
        timing: { start: 0.74, end: 0.94 },
        content: {
          eyebrow: "Chapter 04",
          headline: "Close with an action the viewer can actually take.",
          body: "The final chapter connects the story to publish, embed, or a downstream conversion point.",
          cta: { label: "Publish section", href: "#publish" },
          align: "end",
          theme: "accent",
          treatment: "default",
        },
      },
    ],
  },
];

export const presetDefinitions: PresetDefinition[] = presetDefinitionInputs.map((preset) =>
  PresetDefinitionSchema.parse(preset),
);

export const presetDefinitionMap = new Map(
  presetDefinitions.map((preset) => [preset.id, preset]),
);
