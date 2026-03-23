"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { MediaFrame } from "../motionroll/media-frame";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { EditorPanel } from "./editor-shell";

type ProviderName = "runway" | "luma" | "sora" | "other";
type ProviderAsset = {
  externalId: string;
  generationId?: string;
  title: string;
  previewUrl: string | null;
  status?: "queued" | "running" | "completed" | "failed" | "unsupported";
  createdAt?: string;
  canImport?: boolean;
};

const placeholderAssets = Array.from({ length: 2 }, (_, index) => ({
  id: `placeholder-${index}`,
  title: `Asset ${index + 1}`,
}));

const fieldLabelClassName =
  "text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--foreground-faint)]";

export function ProviderPanel({
  projectId,
  embedded = false,
}: {
  projectId: string;
  embedded?: boolean;
}) {
  const [provider, setProvider] = useState<ProviderName>("runway");
  const [accountLabel, setAccountLabel] = useState("Primary local connection");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [assets, setAssets] = useState<ProviderAsset[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Poll for asset updates every 5 seconds when there are running generations
  useEffect(() => {
    if (!isPolling) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    async function poll() {
      const response = await fetch(`/api/providers/${provider}/assets`);
      if (!response.ok) return;
      const data = await response.json() as { assets?: ProviderAsset[] };
      if (data.assets) setAssets(data.assets);
    }
    void poll();
    pollRef.current = setInterval(() => void poll(), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isPolling, provider]);

  async function connect() {
    const response = await fetch(`/api/providers/${provider}/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountLabel,
        credentials: {
          apiKey,
        },
      }),
    });
    const data = await response.json();
    setMessage(data.metadata?.unsupportedReason ?? "");
  }

  async function loadAssets() {
    const response = await fetch(`/api/providers/${provider}/assets`);
    const data = await response.json();
    setAssets(data.assets ?? []);
    setMessage(data.message ?? "");
  }

  async function importAsset(assetExternalId: string) {
    const response = await fetch(`/api/providers/${provider}/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectId,
        assetExternalId,
      }),
    });
    const data = await response.json();
    setMessage(data.message ?? "");
  }

  const content = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2">
          <span className={fieldLabelClassName}>Provider</span>
          <Select
            value={provider}
            onValueChange={(value) => setProvider(value as ProviderName)}
          >
            <SelectTrigger className="rounded-[12px]" size="default">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="runway">Runway</SelectItem>
              <SelectItem value="luma">Luma</SelectItem>
              <SelectItem value="sora">Sora</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="space-y-2">
          <span className={fieldLabelClassName}>Account label</span>
          <Input className="h-9 rounded-[12px]" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="space-y-2">
          <span className={fieldLabelClassName}>Token</span>
          <Input
            className="h-9 rounded-[12px]"
            placeholder="Paste API key or token"
            value={apiKey} onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <Button type="button" variant="secondary" className="h-9 px-4" onClick={connect}>
          Connect
        </Button>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="quiet" onClick={loadAssets}>
          List assets
        </Button>
      </div>
      {message ? (
        <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
          {message}
        </p>
      ) : null}
      {assets.length > 0 ? (
        <div className="space-y-3">
          {assets.map((asset) => {
            const isRunning = asset.status === "running" || asset.status === "queued";
            const isFailed = asset.status === "failed";
            return (
              <div
                key={asset.externalId}
                className="rounded-[var(--radius-md)] border bg-[var(--panel-bg)] p-3"
                style={{ borderColor: isFailed ? "rgba(248,113,113,0.3)" : "var(--border-subtle)" }}
              >
                <div className="grid gap-3 sm:grid-cols-[132px,minmax(0,1fr)]">
                  <MediaFrame
                    src={asset.previewUrl ?? ""}
                    alt={asset.title}
                    aspectClassName="aspect-[5/4]"
                    overlay={
                      <div className="absolute inset-x-3 top-3 flex justify-between gap-2">
                        <Badge variant={isRunning ? "accent" : "quiet"}>
                          {isFailed ? "Failed" : isRunning ? "Processing..." : "Ready"}
                        </Badge>
                      </div>
                    }
                  />
                  <div className="flex min-w-0 flex-col justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{asset.title}</p>
                      {asset.createdAt ? (
                        <p className="mt-0.5 text-xs text-[var(--foreground-muted)]">
                          {new Date(asset.createdAt).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>
                    {asset.canImport ? (
                      <Button type="button" size="sm" onClick={() => importAsset(asset.externalId)}>
                        <Sparkles className="h-4 w-4" />
                        Import to project
                      </Button>
                    ) : isRunning ? (
                      <p className="text-xs text-[var(--foreground-muted)]">Generating - auto-refreshing...</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs" style={{ color: "var(--foreground-muted)" }}>
            Connect a provider and list assets to fill these slots.
          </p>
          {placeholderAssets.map((asset) => (
            <div
              key={asset.id}
              className="rounded-[var(--radius-md)] border border-dashed border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-3"
            >
              <div className="grid gap-3 sm:grid-cols-[132px,minmax(0,1fr)]">
                <div className="aspect-[5/4] rounded-[var(--radius-sm)] bg-[rgba(255,255,255,0.04)]" />
                <div className="flex min-w-0 flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded-full bg-[rgba(255,255,255,0.08)]" />
                    <div className="h-3 w-24 rounded-full bg-[rgba(255,255,255,0.05)]" />
                  </div>
                  <div className="h-8 w-24 rounded-[10px] bg-[rgba(255,255,255,0.05)]" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="space-y-3">{content}</div>;
  }

  return (
    <EditorPanel title="Import AI scene" badge={<Badge variant="accent">Runway / Luma / Sora</Badge>}>
      {content}
    </EditorPanel>
  );
}
