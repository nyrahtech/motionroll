/**
 * api-utils.ts — shared helpers for Next.js API route handlers.
 */
import { NextResponse } from "next/server";
import { ZodSchema } from "zod";

/**
 * Parses the request JSON against a Zod schema.
 * Returns a 400 NextResponse on validation failure instead of throwing.
 *
 * @example
 * const result = await parseBody(request, mySchema);
 * if (result.error) return result.error;
 * const body = result.data; // fully typed
 */
export async function parseBody<T>(
  request: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T; error: null } | { data: null; error: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      data: null,
      error: NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return {
      data: null,
      error: NextResponse.json(
        { error: "Validation failed.", issues },
        { status: 400 },
      ),
    };
  }

  return { data: result.data, error: null };
}

/**
 * Wraps an API route handler so unhandled errors return 500 instead of crashing.
 * Logs the error server-side.
 */
export function withErrorBoundary<TContext = unknown>(
  handler: (request: Request, context: TContext) => Promise<NextResponse>,
) {
  return async (request: Request, context: TContext) => {
    try {
      return await handler(request, context);
    } catch (err) {
      // Re-throw NextResponse (from requireAuth throws)
      if (err instanceof NextResponse) throw err;
      console.error("[MotionRoll API]", request.method, request.url, err);
      return NextResponse.json({ error: "Internal server error." }, { status: 500 });
    }
  };
}
