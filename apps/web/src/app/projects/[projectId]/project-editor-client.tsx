"use client";

import dynamic from "next/dynamic";
import type { EditorContainerProps } from "@/components/builder/editor-types";
import { EditorSkeleton } from "@/components/builder/editor-skeleton";

const ProjectEditor = dynamic(
  () => import("@/components/builder/project-builder-restored").then((module) => module.ProjectEditor),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

export function ProjectEditorClient(props: EditorContainerProps) {
  return <ProjectEditor {...props} />;
}
