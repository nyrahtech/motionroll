"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { MediaFrame } from "@/components/motionroll/media-frame";
import { StatusPill } from "@/components/motionroll/surfaces";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EditorPanel } from "./editor-shell";

type ProviderName = "runway" | "luma" | "sora" | "other";
type ProviderAsset = {
  externalId: string;
  title: string;
  previewUrl: string;
};

const selectClassName =
  "focus-ring flex h-9 w-full rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--panel-bg-muted)] px-3 py-2 text-sm text-[var(--foreground)]";

export function ProviderPanel({ projectId }: { projectId: string }) {
  const form = useForm({
    defaultValues: {
      provider: "runway" as ProviderName,
      accountLabel: "Primary local connection",
      apiKey: "",
    },
  });
  const [message, setMessage] = useState(
    "Provider calls are scaffolded in v1. Connection persistence is real; live generation is not.",
  );
  const [assets, setAssets] = useState<ProviderAsset[]>([]);

  async function connect() {
    const values = form.getValues();
    const response = await fetch(`/api/providers/${values.provider}/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accountLabel: values.accountLabel,
        credentials: {
          apiKey: values.apiKey,
        },
      }),
    });
    const data = await response.json();
    setMessage(data.metadata?.unsupportedReason ?? "Connection saved.");
  }

  async function loadAssets() {
    const values = form.getValues();
    const response = await fetch(`/api/providers/${values.provider}/assets`);
    const data = await response.json();
    setAssets(data.assets ?? []);
    setMessage(data.message ?? "Loaded scaffolded assets.");
  }

  async function importAsset(assetExternalId: string) {
    const values = form.getValues();
    const response = await fetch(`/api/providers/${values.provider}/import`, {
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
    setMessage(data.message ?? "Import scaffold recorded.");
  }

  return (
    <EditorPanel
      title="Import from an AI provider"
      description="Connection persistence is real. Provider generation and file downloads stay honest stubs for now."
      badge={<StatusPill label="Stub-aware" tone="warning" />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="field-label">Provider</span>
          <select className={selectClassName} {...form.register("provider")}>
            <option value="runway">Runway</option>
            <option value="luma">Luma</option>
            <option value="sora">Sora</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="space-y-2">
          <span className="field-label">Account label</span>
          <Input {...form.register("accountLabel")} />
        </label>
      </div>
      <label className="space-y-2">
        <span className="field-label">Credential placeholder</span>
        <Input placeholder="Paste API key or token" {...form.register("apiKey")} />
      </label>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={connect}>
          Connect account
        </Button>
        <Button type="button" variant="quiet" onClick={loadAssets}>
          List generated assets
        </Button>
      </div>
      <p className="text-sm leading-6 text-[var(--foreground-muted)]">{message}</p>
      {assets.length > 0 ? (
        <div className="space-y-3">
          {assets.map((asset) => (
            <div
              key={asset.externalId}
              className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--panel-bg)] p-3"
            >
              <div className="grid gap-3 sm:grid-cols-[132px,minmax(0,1fr)]">
                <MediaFrame
                  src={asset.previewUrl}
                  alt={asset.title}
                  aspectClassName="aspect-[5/4]"
                  overlay={
                    <div className="absolute inset-x-3 top-3 flex justify-between gap-2">
                      <Badge variant="quiet">Provider preview</Badge>
                    </div>
                  }
                />
                <div className="flex min-w-0 flex-col justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-white">{asset.title}</p>
                      <Badge variant="quiet">Stub asset</Badge>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[var(--foreground-muted)]">
                      {asset.externalId}
                    </p>
                  </div>
                  <Button type="button" size="sm" onClick={() => importAsset(asset.externalId)}>
                    <Sparkles className="h-4 w-4" />
                    Import into project
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </EditorPanel>
  );
}
