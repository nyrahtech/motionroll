import { createClerkClient } from "@clerk/backend";
import {
  isDevelopmentFromPublishableKey,
  isDevelopmentFromSecretKey,
  parsePublishableKey,
} from "@clerk/shared/keys";
import { env } from "@/lib/env";

function buildMismatchError(details: string) {
  return new Error(
    `MotionRoll Clerk configuration error: ${details} Update NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env so they come from the same Clerk application, then restart the dev server and clear localhost Clerk cookies.`,
  );
}

function normalizeFrontendApi(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function shouldSkipClerkValidation() {
  return !env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !env.CLERK_SECRET_KEY;
}

let validationPromise: Promise<void> | null = null;

export async function assertClerkConfigurationIsValid() {
  if (shouldSkipClerkValidation()) {
    return;
  }

  if (validationPromise) {
    return validationPromise;
  }

  validationPromise = (async () => {
    const publishableKey = env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    const secretKey = env.CLERK_SECRET_KEY;

    if (!publishableKey || !secretKey) {
      return;
    }

    const parsedPublishableKey = parsePublishableKey(publishableKey, { fatal: true });
    const publishableIsDevelopment = isDevelopmentFromPublishableKey(publishableKey);
    const secretIsDevelopment = isDevelopmentFromSecretKey(secretKey);

    if (publishableIsDevelopment !== secretIsDevelopment) {
      throw buildMismatchError(
        `The publishable key (${publishableIsDevelopment ? "development" : "production"}) and secret key (${secretIsDevelopment ? "development" : "production"}) are from different Clerk environments.`,
      );
    }

    try {
      const clerk = createClerkClient({ secretKey });
      const domains = await clerk.domains.list();
      const frontendApis = domains.data
        .map((domain) => domain.frontendApiUrl)
        .filter((value): value is string => Boolean(value))
        .map(normalizeFrontendApi);
      const expectedFrontendApi = normalizeFrontendApi(parsedPublishableKey.frontendApi);

      if (frontendApis.length > 0 && !frontendApis.includes(expectedFrontendApi)) {
        throw buildMismatchError(
          `The publishable key points to ${expectedFrontendApi}, but the secret key belongs to a Clerk instance serving ${frontendApis.join(", ")}.`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("MotionRoll Clerk configuration error:")) {
        throw error;
      }

      throw new Error(
        `MotionRoll Clerk configuration validation failed: ${
          error instanceof Error ? error.message : String(error)
        }. Double-check the Clerk keys in .env, restart the dev server, and clear localhost Clerk cookies if you recently switched instances.`,
      );
    }
  })();

  return validationPromise;
}
