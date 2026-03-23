/**
 * manifest-loader — fetches and validates a published project manifest from a URL.
 */
import type { ProjectManifest } from "../../../shared/src/index";

export async function fetchManifest(url: string): Promise<ProjectManifest> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch manifest from ${url}: HTTP ${response.status}`,
    );
  }
  return response.json() as Promise<ProjectManifest>;
}

export function assertManifestSection(manifest: ProjectManifest): void {
  if (!manifest.sections[0]) {
    throw new Error("Manifest must include at least one section.");
  }
}
