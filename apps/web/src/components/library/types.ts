export type LibraryProjectListItem = Awaited<
  ReturnType<typeof import("@/lib/data/projects").getMyProjects>
>[number];
