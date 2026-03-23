/**
 * GET /api/projects/[projectId]/export
 *
 * Streams a ZIP bundle containing:
 *  - manifest.json      — full project manifest
 *  - runtime.js         — bundled MotionRoll runtime
 *  - frames/            — all frame images (downloaded from S3)
 *  - index.html         — self-contained bootstrap page
 *  - README.txt         — embed instructions
 */
import { NextResponse } from "next/server";
import path from "path";
import { buildProjectManifest } from "@/lib/manifest";
import { requireAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { getProjectById } from "@/lib/data/projects";

export const dynamic = "force-dynamic";

function resolveLocalPublicAssetPath(url: string) {
  if (!url.startsWith("/")) {
    return null;
  }

  return path.join(process.cwd(), "public", url.replace(/^\/+/, ""));
}

const README = `MotionRoll Export Bundle
========================

This bundle contains everything you need to self-host your MotionRoll
cinematic scroll section.

Files
-----
  manifest.json  — Project manifest used by the runtime
  runtime.js     — MotionRoll browser runtime (no external dependencies)
  frames/        — Frame image sequence
  index.html     — Standalone demo page (open in a browser)

Embedding
---------
Copy the bundle to your web server and embed via:

  <div id="motionroll-container"></div>
  <script src="runtime.js"></script>
  <script>
    MotionRoll.createScrollSection(
      document.getElementById("motionroll-container"),
      /* inject manifest.json contents here */
    );
  </script>

Frames must be served from the same origin or have CORS headers set.

For questions visit https://motionroll.io
`;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { userId } = await requireAuth();
  const { projectId } = await params;

  const project = await getProjectById(projectId, userId);
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let manifest: Awaited<ReturnType<typeof buildProjectManifest>>;
  try {
    manifest = await buildProjectManifest(projectId, { userId });
  } catch (error) {
    logger.error("Failed to build export manifest", {
      projectId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to prepare export bundle" }, { status: 500 });
  }

  if (!manifest) {
    return NextResponse.json({ error: "No manifest available" }, { status: 404 });
  }

  const section = manifest.sections[0];
  if (!section) {
    return NextResponse.json({ error: "No section in manifest" }, { status: 400 });
  }

  // Build filename
  const safeTitle = (manifest.project?.title ?? "motionroll-export")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  // Collect all frame URLs
  const frameUrls: Array<{ url: string; filename: string }> = [];
  for (const [frameIndex, frame] of section.frameAssets.entries()) {
    const variant =
      frame.variants.find((v) => v.kind === "desktop" && v.url) ??
      frame.variants[0];
    if (!variant?.url) continue;
    const ext = variant.url.split("?")[0]?.split(".").pop() ?? "jpg";
    frameUrls.push({
      url: variant.url,
      filename: `frames/frame-${String(frameIndex).padStart(5, "0")}.${ext}`,
    });
  }

  // Rewrite manifest to use relative frame paths
  const exportManifest = {
    ...manifest,
    sections: manifest.sections.map((sec, sIdx) => ({
      ...sec,
      frameAssets: sec.frameAssets.map((frame, fIdx) => ({
        ...frame,
        variants: frame.variants.map((v) => {
          const entry = frameUrls.find((f) =>
            f.url === v.url || f.filename === `frames/frame-${String(fIdx).padStart(5, "0")}.jpg`,
          );
          return entry ? { ...v, url: entry.filename } : v;
        }),
      })),
    })),
  };

  // Build index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${manifest.project?.title ?? "MotionRoll"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000; }
    #motionroll { width: 100%; }
  </style>
</head>
<body>
  <div id="motionroll"></div>
  <script src="runtime.js"></script>
  <script>
    MotionRoll.createScrollSection(
      document.getElementById('motionroll'),
      ${JSON.stringify(exportManifest, null, 2)}
    );
  </script>
</body>
</html>`;

  // Try to load runtime.js from built output
  let runtimeJs = "// MotionRoll runtime not bundled — run `npm run build` in packages/runtime first\n";
  try {
    const { readFileSync } = await import("fs");
    const runtimePath = path.join(
      process.cwd(),
      "../../packages/runtime/dist/index.js",
    );
    runtimeJs = readFileSync(runtimePath, "utf-8");
  } catch {
    // Runtime not built yet — ship a placeholder
  }

  // Build ZIP in memory using streaming TransformStream
  // Since archiver needs Node streams, we collect chunks into a Buffer then stream response.
  try {
    const archiver = (await import("archiver")).default;
    const { readFile } = await import("fs/promises");
    const { Writable } = await import("stream");

    const chunks: Buffer[] = [];
    const writable = new Writable({
      write(chunk: Buffer, _enc, cb) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        cb();
      },
    });

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(writable);

    archive.append(JSON.stringify(exportManifest, null, 2), { name: "manifest.json" });
    archive.append(runtimeJs, { name: "runtime.js" });
    archive.append(indexHtml, { name: "index.html" });
    archive.append(README, { name: "README.txt" });

    // Download and add frames
    const frameDownloads = frameUrls.map(async ({ url, filename }) => {
      try {
        const localPublicPath = resolveLocalPublicAssetPath(url);
        if (localPublicPath) {
          const buffer = await readFile(localPublicPath);
          archive.append(buffer, { name: filename });
          return;
        }

        const response = await fetch(url);
        if (!response.ok) return;
        const buffer = Buffer.from(await response.arrayBuffer());
        archive.append(buffer, { name: filename });
      } catch {
        // Skip frames that fail to download
      }
    });

    await Promise.all(frameDownloads);
    await archive.finalize();

    await new Promise<void>((resolve) => writable.on("finish", resolve));

    const zipBuffer = Buffer.concat(chunks);

    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}.zip"`,
        "Content-Length": String(zipBuffer.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error("Export failed", { projectId, error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      { error: "Failed to generate export bundle" },
      { status: 500 },
    );
  }
}
