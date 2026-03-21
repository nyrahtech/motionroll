"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { MediaFrame } from "@/components/motionroll/media-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EditorPanel } from "./editor-shell";

type ProviderName = "runway" | "luma" | "sora" | "other";
type ProviderAsset = {
  externalId: string;
  title: string;
  previewUrl: string;
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
  const form = useForm({
    defaultValues: {
      provider: "runway" as ProviderName,
      accountLabel: "Primary local connection",
      apiKey: "",
    },
  });
  const [message, setMessage] = useState("");
  const [assets, setAssets] = useState<ProviderAsset[]>([]);
  const provider = form.watch("provider");

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
    setMessage(data.metadata?.unsupportedReason ?? "");
  }

  async function loadAssets() {
    const values = form.getValues();
    const response = await fetch(`/api/providers/${values.provider}/assets`);
    const data = await response.json();
    setAssets(data.assets ?? []);
    setMessage(data.message ?? "");
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
    setMessage(data.message ?? "");
  }

  const content = (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-2">
          <span className={fieldLabelClassName}>Provider</span>
          <Select
            value={provider}
            onValueChange={(value) =>
              form.setValue("provider", value as ProviderName, { shouldDirty: true })
            }
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
          <Input className="h-9 rounded-[12px]" {...form.register("accountLabel")} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className="space-y-2">
          <span className={fieldLabelClassName}>Token</span>
          <Input
            className="h-9 rounded-[12px]"
            placeholder="Paste API key or token"
            {...form.register("apiKey")}
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
                      <Badge variant="quiet">Preview</Badge>
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
                    Import
                  </Button>
                </div>
              </div>
            </div>
          ))}
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
    <EditorPanel title="Import AI scene" badge={<Badge variant="accent">Runway · Luma · Sora</Badge>}>
      {content}
    </EditorPanel>
  );
}
