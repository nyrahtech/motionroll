import "@/lib/load-env";
import { ensureStorageBucket } from "@/lib/storage/s3-adapter";

async function main() {
  const result = await ensureStorageBucket();

  console.log(
    JSON.stringify(
      {
        bucket: result.bucket,
        created: result.created,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
