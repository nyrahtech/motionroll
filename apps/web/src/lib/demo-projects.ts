import { OverlayDefinitionSchema, type OverlayDefinition, type PresetId } from "@motionroll/shared";
import motionrollDemoMetadata from "../../public/motionroll_demo_sequence/metadata.json";

export type DemoProjectSeed = {
  slug: string;
  title: string;
  summary: string;
  presetId: PresetId;
  sectionTitle: string;
  statusLabel: string;
  publishHeadline: string;
  sourceVideoUrl: string;
  posterUrl: string;
  fallbackVideoUrl?: string;
  frameUrls: string[];
  frameRate?: number;
  frameCount?: number;
  durationMs?: number;
  width?: number;
  height?: number;
  sourceWidth?: number;
  sourceHeight?: number;
  sourceBytes?: number;
  fallbackBehavior?: {
    mobile: "poster" | "video" | "sequence";
    reducedMotion: "poster" | "video" | "sequence";
  };
  commonText: {
    content: string;
  };
  cta: {
    label: string;
    href: string;
  };
  sectionHeightVh: number;
  scrubStrength: number;
  frameRangeEnd: number;
  overlays: OverlayDefinition[];
};

const motionrollDemoFrameUrls = Array.from(
  { length: motionrollDemoMetadata.frameCount },
  (_, index) => {
    return `${motionrollDemoMetadata.frameBaseUrl}/frame-${String(index + 1).padStart(4, "0")}.webp`;
  },
);

const motionrollDemoSteps = [
  "Import your video",
  "Shape the timing",
  "Refine the story",
  "Publish the section",
];

function buildTextContent(...parts: string[]) {
  return parts.map((part) => part.trim()).filter(Boolean).join("\n\n");
}

function toOverlay(overlay: unknown): OverlayDefinition {
  return OverlayDefinitionSchema.parse(overlay);
}

const motionrollDemoOverlays: OverlayDefinition[] = motionrollDemoSteps.map((step, index) => {
  const starts = [0.08, 0.29, 0.52, 0.76];
  const ends = [0.22, 0.43, 0.66, 0.92];
  const bodies = [
    "Bring a source clip or AI-imported video into MotionRoll and start from a real moving section, not a static mockup.",
    "Drag the timing blocks, trim the section span, and scrub the preview until the motion lands in the right place.",
    "Edit the headline, supporting copy, CTA, and steps without leaving the same timeline-first workspace.",
    "Ship the hosted section when preview, fullscreen, and publish all line up on the same frame mapping.",
  ];

  return toOverlay({
    id: `motionroll-step-${index + 1}`,
    timing: { start: starts[index] ?? 0, end: ends[index] ?? 1 },
    content: {
      text: buildTextContent(`Step ${index + 1}`, step, bodies[index] ?? ""),
      align: index % 2 === 0 ? "start" : "end",
      theme: "dark",
      treatment: "default",
      cta:
        index === motionrollDemoSteps.length - 1
          ? { label: "Start editing", href: "#editor" }
          : undefined,
    },
  });
});

export const demoProjectSeeds: DemoProjectSeed[] = [
  {
    slug: "demo-motionroll-editor",
    title: "MotionRoll Demo",
    summary:
      "The default MotionRoll self-demo uses the velocity sequence asset pack so scroll, preview, fullscreen, and publish all share the same baseline behavior.",
    presetId: "scroll-sequence",
    sectionTitle: "MotionRoll hero section",
    statusLabel: "Default working demo",
    publishHeadline: "Open MotionRoll and land directly inside one working self-demo with real scroll-sequence behavior.",
    sourceVideoUrl: motionrollDemoMetadata.sourceVideoUrl,
    posterUrl: motionrollDemoMetadata.posterUrl,
    fallbackVideoUrl: motionrollDemoMetadata.fallbackVideoUrl,
    frameUrls: motionrollDemoFrameUrls,
    frameRate: motionrollDemoMetadata.frameRate,
    frameCount: motionrollDemoMetadata.frameCount,
    durationMs: motionrollDemoMetadata.durationMs,
    width: motionrollDemoMetadata.width,
    height: motionrollDemoMetadata.height,
    sourceWidth: motionrollDemoMetadata.sourceWidth,
    sourceHeight: motionrollDemoMetadata.sourceHeight,
    sourceBytes: motionrollDemoMetadata.sourceBytes,
    fallbackBehavior: {
      mobile: "sequence",
      reducedMotion: "sequence",
    },
    commonText: {
      content: buildTextContent(
        "MotionRoll Demo",
        "Scroll stories that actually move",
        "MotionRoll turns video into polished, scroll-driven web sections you can edit, time, and publish in one place.",
      ),
    },
    cta: {
      label: "Start editing",
      href: "#editor",
    },
      sectionHeightVh: 600,
    scrubStrength: 0.85,
    frameRangeEnd: motionrollDemoMetadata.frameCount - 1,
    overlays: motionrollDemoOverlays,
  },
  {
    slug: "demo-aether-product-reveal",
    title: "Aether Phone Launch",
    summary:
      "A polished Product Reveal demo with launch-style copy, feature beats, and a publish-ready flow.",
    presetId: "product-reveal",
    sectionTitle: "Launch reveal section",
    statusLabel: "Product reveal sample",
    publishHeadline: "Show a premium hardware reveal in under a minute.",
    sourceVideoUrl: "/demo/product-reveal/frame-1.png",
    posterUrl: "/demo/product-reveal/frame-1.png",
    frameUrls: [
      "/demo/product-reveal/frame-0.png",
      "/demo/product-reveal/frame-1.png",
      "/demo/product-reveal/frame-2.png",
    ],
    commonText: {
      content: buildTextContent(
        "Aether launch",
        "Introduce the hardware first, then let the copy land with intent.",
        "This demo is tuned for launch-style storytelling: a clear hero motion, deliberate feature callouts, and a hosted publish flow that feels production-facing.",
      ),
    },
    cta: {
      label: "Reserve a preview",
      href: "#reserve",
    },
    sectionHeightVh: 280,
    scrubStrength: 0.8,
    frameRangeEnd: 2,
    overlays: [
      toOverlay({
        id: "hero-reveal",
        timing: { start: 0.04, end: 0.24 },
        content: {
          text: buildTextContent(
            "Aether One",
            "A launch-style reveal with the object carrying the first beat.",
            "The copy stays quiet until the motion earns it, which makes the opening feel intentional instead of overloaded.",
          ),
          align: "start",
          theme: "light",
          treatment: "default",
        },
      }),
      toOverlay({
        id: "finish-detail",
        timing: { start: 0.34, end: 0.58 },
        content: {
          text: buildTextContent(
            "Finish and form",
            "Use the mid-sequence to point at a material or form detail.",
            "This is the kind of preset you use when a product page needs Apple-style confidence without hand-built animation logic.",
          ),
          align: "center",
          theme: "accent",
          treatment: "default",
        },
      }),
      toOverlay({
        id: "launch-cta",
        timing: { start: 0.7, end: 0.92 },
        content: {
          text: buildTextContent(
            "Publish anywhere",
            "The same project can ship as a hosted preview or a script embed.",
            "Hosted publish is the real path in MotionRoll v1, so the manifest and runtime stay aligned.",
          ),
          cta: { label: "Open publish", href: "#publish" },
          align: "end",
          theme: "dark",
          treatment: "default",
        },
      }),
    ],
  },
  {
    slug: "demo-cascade-feature-walkthrough",
    title: "Cascade Workflow Walkthrough",
    summary:
      "A Feature Walkthrough demo that explains a focused product workflow without feeling like a tutorial overlay pile.",
    presetId: "feature-walkthrough",
    sectionTitle: "Workflow walkthrough section",
    statusLabel: "Guided product story",
    publishHeadline: "Turn a product workflow into a guided scroll explanation.",
    sourceVideoUrl: "/demo/feature-walkthrough/frame-1.png",
    posterUrl: "/demo/feature-walkthrough/frame-1.png",
    frameUrls: [
      "/demo/feature-walkthrough/frame-0.png",
      "/demo/feature-walkthrough/frame-1.png",
      "/demo/feature-walkthrough/frame-2.png",
    ],
    commonText: {
      content: buildTextContent(
        "Cascade workspace",
        "Walk the viewer through one focused product flow instead of showing the whole app.",
        "This demo shows how the Feature Walkthrough preset can explain a workflow with measured pacing, scoped overlays, and a clearer ending beat.",
      ),
    },
    cta: {
      label: "View workflow",
      href: "#workflow",
    },
    sectionHeightVh: 320,
    scrubStrength: 0.95,
    frameRangeEnd: 2,
    overlays: [
      toOverlay({
        id: "step-one",
        timing: { start: 0.05, end: 0.24 },
        content: {
          text: buildTextContent(
            "Step 01",
            "Start by orienting the user before you explain the detail.",
            "The first chapter frames the workflow so the rest of the section can feel guided, not chaotic.",
          ),
          align: "start",
          theme: "light",
          treatment: "default",
        },
      }),
      toOverlay({
        id: "step-two",
        timing: { start: 0.34, end: 0.56 },
        content: {
          text: buildTextContent(
            "Step 02",
            "Call out the active region when the motion reaches it.",
            "Feature Walkthrough works best when the copy matches a real focus shift, not when every beat says everything at once.",
          ),
          align: "end",
          theme: "accent",
          treatment: "default",
        },
      }),
      toOverlay({
        id: "step-three",
        timing: { start: 0.68, end: 0.9 },
        content: {
          text: buildTextContent(
            "Step 03",
            "End on outcome, not on interface chrome.",
            "The last beat reinforces what changed for the user and prepares the section for a publish-ready handoff.",
          ),
          cta: { label: "See Editor", href: "#editor" },
          align: "start",
          theme: "dark",
          treatment: "default",
        },
      }),
    ],
  },
  {
    slug: "demo-orbit-device-spin",
    title: "Orbit Speaker Spin",
    summary:
      "A Device Spin demo with a studio-style hardware presentation that is easy to screenshot and easy to understand.",
    presetId: "device-spin",
    sectionTitle: "Device spin showcase",
    statusLabel: "Hardware showcase",
    publishHeadline: "Use a compact spin clip to sell shape, finish, and craft.",
    sourceVideoUrl: "/demo/device-spin/frame-1.png",
    posterUrl: "/demo/device-spin/frame-1.png",
    frameUrls: [
      "/demo/device-spin/frame-0.png",
      "/demo/device-spin/frame-1.png",
      "/demo/device-spin/frame-2.png",
    ],
    commonText: {
      content: buildTextContent(
        "Orbit speaker",
        "A compact device spin that makes form, edge detail, and finish easy to sell.",
        "This demo is intentionally simple: a controlled turntable-style motion with copy that supports the object instead of competing with it.",
      ),
    },
    cta: {
      label: "Inspect design",
      href: "#design",
    },
    sectionHeightVh: 240,
    scrubStrength: 0.9,
    frameRangeEnd: 2,
    overlays: [
      toOverlay({
        id: "spin-open",
        timing: { start: 0.06, end: 0.28 },
        content: {
          text: buildTextContent(
            "Silhouette first",
            "Lead with the object shape before the material details take over.",
            "This is a strong preset for premium accessories, speakers, wearables, and industrial design stories.",
          ),
          align: "start",
          theme: "light",
          treatment: "default",
        },
      }),
      toOverlay({
        id: "spin-mid",
        timing: { start: 0.42, end: 0.68 },
        content: {
          text: buildTextContent(
            "Material detail",
            "Use the middle beat to surface the finish and edge treatment.",
            "A short, clean source clip is often enough to communicate product craft when the runtime mapping is stable.",
          ),
          align: "end",
          theme: "accent",
          treatment: "default",
        },
      }),
      toOverlay({
        id: "spin-close",
        timing: { start: 0.76, end: 0.94 },
        content: {
          text: buildTextContent(
            "Ready to publish",
            "Turn a small motion study into a section that can ship anywhere.",
            "The hosted path is primary, and script embed is there when you need a custom placement.",
          ),
          cta: { label: "Open demo", href: "#demo" },
          align: "end",
          theme: "dark",
          treatment: "default",
        },
      }),
    ],
  },
];

export const demoProjectMap = new Map(demoProjectSeeds.map((project) => [project.slug, project]));
