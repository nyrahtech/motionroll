import "@/lib/load-env";
import { presetDefinitions } from "@motionroll/shared";
import { seedTemplates } from "@/lib/data/workspace-bootstrap";

async function seed() {
  await seedTemplates();

  console.log(
    JSON.stringify(
      {
        templatesSeeded: presetDefinitions.length,
        demoProjectsSeeded: 0,
        note: "Starter demo workspaces are now created on first authenticated sign-in.",
      },
      null,
      2,
    ),
  );
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
