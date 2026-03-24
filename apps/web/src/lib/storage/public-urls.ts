const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_STORAGE_PUBLIC_BASE_URL = "http://127.0.0.1:9000/motionroll-assets";

function getAppBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? DEFAULT_APP_URL).replace(/\/$/, "");
}

function getStoragePublicBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL ??
    DEFAULT_STORAGE_PUBLIC_BASE_URL
  ).replace(/\/$/, "");
}

export function getStorageProxyPath(key: string) {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `/api/storage/${encodedKey}`;
}

export function getStoragePublicUrl(key: string) {
  return `${getAppBaseUrl()}${getStorageProxyPath(key)}`;
}

export function resolveStorageReadUrl(publicUrl: string | undefined, storageKey?: string) {
  if (!publicUrl) {
    return "";
  }

  const storageBaseUrl = getStoragePublicBaseUrl();
  if (publicUrl.startsWith(`${storageBaseUrl}/`)) {
    const key = publicUrl.slice(storageBaseUrl.length + 1);
    return getStoragePublicUrl(key);
  }

  const appBaseUrl = getAppBaseUrl();
  if (storageKey && publicUrl.startsWith(`${appBaseUrl}/api/storage/`)) {
    return publicUrl;
  }

  return publicUrl;
}
