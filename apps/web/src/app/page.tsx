import { redirect } from "next/navigation";
import { requirePageAuth } from "@/lib/auth";
import { getEditorHomeProjectForUser } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

function isRetryableWorkspaceFailure(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return [
    "ECONNREFUSED",
    "connect ECONNREFUSED",
    "Failed query:",
    "timeout expired",
  ].some((marker) => error.message.includes(marker));
}

export default async function HomePage() {
  const user = await requirePageAuth();
  let target = null;
  try {
    target = await getEditorHomeProjectForUser(user);
  } catch (error) {
    if (isRetryableWorkspaceFailure(error)) {
      redirect("/library?workspace=home_unavailable");
    }
    throw error;
  }

  if (target) {
    redirect(`/projects/${target.id}`);
  }

  redirect("/library");
}
