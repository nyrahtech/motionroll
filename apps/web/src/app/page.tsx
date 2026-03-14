import { redirect } from "next/navigation";
import { getEditorHomeProject } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const target = await getEditorHomeProject().catch(() => null);

  if (target) {
    redirect(`/projects/${target.id}`);
  }

  redirect("/library");
}
