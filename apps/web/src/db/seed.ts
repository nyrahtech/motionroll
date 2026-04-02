import "@/lib/load-env";

async function seed() {
  console.log(
    JSON.stringify(
      {
        message: "No starter seeding is required.",
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
