import type { PresetId } from "@motionroll/shared";

export type DemoProjectStarter = {
  presetId: PresetId;
  title?: string;
  sectionTitle?: string;
};

export type DemoProjectDefinition = {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  starter: DemoProjectStarter;
};

export const demoProjects: readonly DemoProjectDefinition[] = [
  {
    id: "ocean-depth",
    title: "Ocean Depth",
    description: "Immersive scroll storytelling that shows the cinematic side of MotionRoll.",
    thumbnailUrl: "/library-demos/ocean-depth.jpg",
    starter: {
      presetId: "scroll-sequence",
      title: "Ocean Depth",
      sectionTitle: "Ocean Depth Story",
    },
  },
  {
    id: "product-reveal",
    title: "Product Reveal",
    description: "Premium landing-page storytelling with text, media, and composed scene design.",
    thumbnailUrl: "/library-demos/product-reveal.jpg",
    starter: {
      presetId: "product-reveal",
      title: "Product Reveal",
      sectionTitle: "Product Reveal Scene",
    },
  },
  {
    id: "product-spin",
    title: "Product Spin",
    description: "Interactive 360 motion for premium products like cars, watches, sneakers, and bottles.",
    thumbnailUrl: "/library-demos/product-spin.jpg",
    starter: {
      presetId: "device-spin",
      title: "Product Spin",
      sectionTitle: "Product Spin Scene",
    },
  },
  {
    id: "editorial-story",
    title: "Editorial Story",
    description: "Text-led immersive storytelling with a calmer, more artistic editorial mood.",
    thumbnailUrl: "/library-demos/editorial-story.jpg",
    starter: {
      presetId: "chaptered-scroll-story",
      title: "Editorial Story",
      sectionTitle: "Editorial Story Scene",
    },
  },
] as const;

export const featuredDemoProject = demoProjects[0];

export const demoProjectMap = new Map(demoProjects.map((project) => [project.id, project]));
