"use client";

type ErrorLikeWithDigest = {
  name?: unknown;
  message?: unknown;
  stack?: unknown;
  digest?: unknown;
  status?: unknown;
  statusText?: unknown;
  url?: unknown;
};

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getClientErrorReference(error: unknown, fallback: string) {
  if (isObjectLike(error) && typeof error.digest === "string" && error.digest.length > 0) {
    return error.digest;
  }
  return fallback;
}

export function serializeClientError(error: unknown) {
  if (error instanceof Response) {
    return {
      type: "Response",
      status: error.status,
      statusText: error.statusText,
      url: error.url || undefined,
      redirected: error.redirected,
    };
  }

  if (error instanceof Error) {
    const errorWithDigest = error as Error & { digest?: string };
    return {
      type: error.name || "Error",
      message: error.message,
      digest: errorWithDigest.digest,
      stack: error.stack,
    };
  }

  if (isObjectLike(error)) {
    const candidate = error as ErrorLikeWithDigest;
    return {
      type: typeof candidate.name === "string" ? candidate.name : "Object",
      message: typeof candidate.message === "string" ? candidate.message : undefined,
      digest: typeof candidate.digest === "string" ? candidate.digest : undefined,
      status: typeof candidate.status === "number" ? candidate.status : undefined,
      statusText: typeof candidate.statusText === "string" ? candidate.statusText : undefined,
      url: typeof candidate.url === "string" ? candidate.url : undefined,
    };
  }

  return {
    type: typeof error,
    message: typeof error === "string" ? error : String(error),
  };
}

export function logHandledClientError(label: string, error: unknown) {
  console.warn(label, serializeClientError(error));
}
