"use client";

import dynamic from "next/dynamic";
import type { EditorContainerProps } from "@/components/builder/editor-types";

const ProjectEditor = dynamic(
  () => import("@/components/builder/project-builder").then((module) => module.ProjectEditor),
  { ssr: false },
);

export function ProjectEditorClient(props: EditorContainerProps) {
  return <ProjectEditor {...props} />;
}
