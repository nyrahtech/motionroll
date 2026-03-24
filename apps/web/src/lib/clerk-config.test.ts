import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  domainsList: vi.fn(),
  parsePublishableKey: vi.fn(),
  isDevelopmentFromPublishableKey: vi.fn(),
  isDevelopmentFromSecretKey: vi.fn(),
  env: {
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
    CLERK_SECRET_KEY: "sk_test_example",
  },
}));

vi.mock("@clerk/backend", () => ({
  createClerkClient: vi.fn(() => ({
    domains: {
      list: mocks.domainsList,
    },
  })),
}));

vi.mock("@clerk/shared/keys", () => ({
  parsePublishableKey: mocks.parsePublishableKey,
  isDevelopmentFromPublishableKey: mocks.isDevelopmentFromPublishableKey,
  isDevelopmentFromSecretKey: mocks.isDevelopmentFromSecretKey,
}));

vi.mock("@/lib/env", () => ({
  env: mocks.env,
}));

describe("assertClerkConfigurationIsValid", () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = "pk_test_example";
    mocks.env.CLERK_SECRET_KEY = "sk_test_example";
    mocks.parsePublishableKey.mockReturnValue({
      frontendApi: "possible-turtle-81.clerk.accounts.dev",
    });
    mocks.isDevelopmentFromPublishableKey.mockReturnValue(true);
    mocks.isDevelopmentFromSecretKey.mockReturnValue(true);
    mocks.domainsList.mockResolvedValue({
      data: [
        {
          frontendApiUrl: "https://possible-turtle-81.clerk.accounts.dev",
        },
      ],
    });
  });

  it("passes when the secret key domains include the publishable key frontend api", async () => {
    const { assertClerkConfigurationIsValid } = await import("./clerk-config");

    await expect(assertClerkConfigurationIsValid()).resolves.toBeUndefined();
  });

  it("throws a helpful error when the keys point at different Clerk instances", async () => {
    mocks.domainsList.mockResolvedValue({
      data: [
        {
          frontendApiUrl: "different-instance.clerk.accounts.dev",
        },
      ],
    });

    const { assertClerkConfigurationIsValid } = await import("./clerk-config");

    await expect(assertClerkConfigurationIsValid()).rejects.toThrow(
      /same Clerk application/i,
    );
  });

  it("throws when the publishable and secret keys come from different environments", async () => {
    mocks.isDevelopmentFromPublishableKey.mockReturnValue(true);
    mocks.isDevelopmentFromSecretKey.mockReturnValue(false);

    const { assertClerkConfigurationIsValid } = await import("./clerk-config");

    await expect(assertClerkConfigurationIsValid()).rejects.toThrow(
      /different Clerk environments/i,
    );
  });
});
