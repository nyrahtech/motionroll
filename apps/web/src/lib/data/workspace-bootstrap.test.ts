import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const mockInsertValues = vi.fn();
  const mockInsert = vi.fn(() => ({
    values: mockInsertValues,
  }));
  const logger = {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };

  return {
    mockInsertValues,
    mockInsert,
    logger,
  };
});

vi.mock("@/lib/logger", () => ({
  logger: mocks.logger,
}));

vi.mock("@/db/client", () => ({
  db: {
    insert: mocks.mockInsert,
  },
}));

vi.mock("@/db/schema", () => ({
  users: { id: "id" },
}));

function createInsertChain(resultFactory: () => Promise<unknown> | unknown) {
  return {
    onConflictDoUpdate: vi.fn().mockImplementation(resultFactory),
  };
}

describe("ensureUserWorkspace", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-22T12:00:00.000Z"));

    mocks.mockInsert.mockClear();
    mocks.mockInsertValues.mockReset();
    mocks.logger.warn.mockReset();
    mocks.logger.error.mockReset();
    mocks.logger.info.mockReset();
    mocks.logger.debug.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("deduplicates concurrent bootstrap requests for the same user", async () => {
    let resolveInsert!: () => void;
    const insertPromise = new Promise<void>((resolve) => {
      resolveInsert = resolve;
    });
    mocks.mockInsertValues.mockReturnValue(createInsertChain(() => insertPromise));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    const first = ensureUserWorkspace(user);
    const second = ensureUserWorkspace(user);

    expect(mocks.mockInsert).toHaveBeenCalledTimes(1);

    resolveInsert();
    await Promise.all([first, second]);
  });

  it("caches successful bootstrap completion for later requests", async () => {
    mocks.mockInsertValues.mockReturnValue(createInsertChain(() => Promise.resolve(undefined)));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    await ensureUserWorkspace(user);
    const insertCountAfterFirstBootstrap = mocks.mockInsert.mock.calls.length;
    await ensureUserWorkspace(user);

    expect(mocks.mockInsert.mock.calls.length).toBe(insertCountAfterFirstBootstrap);
    expect(mocks.logger.warn).not.toHaveBeenCalled();
  });

  it("backs off retries after a failed bootstrap attempt", async () => {
    mocks.mockInsertValues
      .mockReturnValueOnce(
        createInsertChain(async () => {
          throw new Error("connect ECONNREFUSED 127.0.0.1:5432");
        }),
      )
      .mockReturnValue(createInsertChain(() => Promise.resolve(undefined)));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    await ensureUserWorkspace(user);
    const insertCountDuringBackoff = mocks.mockInsert.mock.calls.length;
    await ensureUserWorkspace(user);

    expect(mocks.mockInsert.mock.calls.length).toBe(insertCountDuringBackoff);
    expect(mocks.logger.warn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(30_000);

    await ensureUserWorkspace(user);

    expect(mocks.mockInsert.mock.calls.length).toBeGreaterThan(insertCountDuringBackoff);
  });

  it("allows a later full bootstrap to upgrade a user after minimal bootstrap", async () => {
    mocks.mockInsertValues.mockReturnValue(createInsertChain(() => Promise.resolve(undefined)));

    const { ensureUserWorkspace } = await import("./workspace-bootstrap");
    const user = { userId: "user_123", email: "owner@test.local", name: "Owner" };

    await ensureUserWorkspace(user, { mode: "minimal" });
    const insertCountAfterMinimalBootstrap = mocks.mockInsert.mock.calls.length;
    await ensureUserWorkspace(user, { mode: "full" });

    expect(mocks.mockInsert.mock.calls.length).toBeGreaterThan(insertCountAfterMinimalBootstrap);
  });
});
