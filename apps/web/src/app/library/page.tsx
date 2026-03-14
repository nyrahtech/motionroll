import { LibraryPage } from "@/components/library/library-page";
import { getArchivedProjects, getDemoProjects, getRecentProjects } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export default async function LibraryRoute() {
  const recentProjects = await getRecentProjects().catch(() => []);
  const demoProjects = await getDemoProjects().catch(() => []);
  const archivedProjects = await getArchivedProjects().catch(() => []);
  return <LibraryPage recentProjects={recentProjects} demoProjects={demoProjects} archivedProjects={archivedProjects} />;
}
