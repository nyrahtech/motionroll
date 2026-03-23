import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  env: {
    CLERK_SECRET_KEY: "sk_test_health" as string | undefined,
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_health" as string | undefined,
    MOTIONROLL_TEST_AUTH_BYPASS: "false",
  },
}));

vi.mock("@/db/client", () => ({
  db: {
    execute: mocks.execute,
  },
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

vi.mock("drizzle-orm", () => ({
  sql: vi.fn((parts: TemplateStringsArray) => parts.join("")),
}));

describe("/api/health", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.execute.mockReset();
    mocks.env.CLERK_SECRET_KEY = "sk_test_health";
    mocks.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_health";
    mocks.env.MOTIONROLL_TEST_AUTH_BYPASS = "false";
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns ok when db is reachable and auth is configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.execute.mockResolvedValueOnce([{ "?column?": 1 }]);

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      db: "ok",
      auth: "configured",
      testAuthBypass: "disabled",
    });
  });

  it("returns degraded when the database is unavailable", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.execute.mockRejectedValueOnce(new Error("db down"));

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      db: "error",
    });
  });

  it("returns degraded in production when auth is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    mocks.env.CLERK_SECRET_KEY = undefined;
    mocks.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = undefined;

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      status: "degraded",
      db: "ok",
      auth: "missing_config",
      launchReady: false,
    });
  });

  it("treats whitespace-padded test auth bypass values as enabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    mocks.execute.mockResolvedValueOnce([{ "?column?": 1 }]);
    mocks.env.MOTIONROLL_TEST_AUTH_BYPASS = " true ";

    const { GET } = await import("./route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      testAuthBypass: "enabled",
      launchReady: false,
    });
  });
});
