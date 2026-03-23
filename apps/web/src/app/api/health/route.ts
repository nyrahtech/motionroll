/**
 * GET /api/health
 *
 * Health check endpoint. No auth, no rate limiting.
 * Returns database reachability plus auth-launch readiness details.
 * In production, missing Clerk config or enabled test auth bypass degrades health.
 */
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const start = Date.now();

  // DB connectivity check
  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // DB unreachable
  }

  const latencyMs = Date.now() - start;
  const authConfigured = Boolean(
    env.CLERK_SECRET_KEY && env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
  const testAuthBypassEnabled = env.MOTIONROLL_TEST_AUTH_BYPASS?.trim() === "true";
  const productionLaunchReady =
    dbOk && authConfigured && !testAuthBypassEnabled;
  const isProduction = process.env.NODE_ENV === "production";
  const status = dbOk && (!isProduction || productionLaunchReady) ? "ok" : "degraded";

  const body = {
    status,
    db: dbOk ? "ok" : "error",
    auth: authConfigured ? "configured" : "missing_config",
    testAuthBypass: testAuthBypassEnabled ? "enabled" : "disabled",
    launchReady: productionLaunchReady,
    latencyMs,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: status === "ok" ? 200 : 503,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
