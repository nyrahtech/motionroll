import { NextResponse } from "next/server";
import { getStorageObject, toWebReadableStream } from "@/lib/storage/s3-adapter";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    key?: string[];
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { key: parts = [] } = await context.params;
  const key = parts.join("/");

  if (!key) {
    return NextResponse.json({ error: "Storage key is required." }, { status: 400 });
  }

  try {
    const object = await getStorageObject(key);
    if (!object.Body) {
      return NextResponse.json({ error: "Storage object not found." }, { status: 404 });
    }

    const headers = new Headers();
    if (object.ContentType) {
      headers.set("Content-Type", object.ContentType);
    }
    if (typeof object.ContentLength === "number") {
      headers.set("Content-Length", String(object.ContentLength));
    }
    if (object.ETag) {
      headers.set("ETag", object.ETag);
    }
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(toWebReadableStream(object.Body), {
      status: 200,
      headers,
    });
  } catch {
    return NextResponse.json({ error: "Storage object not found." }, { status: 404 });
  }
}
