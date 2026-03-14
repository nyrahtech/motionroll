import { NextResponse } from "next/server";
import { z } from "zod";
import { getAiProviderAdapter } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

const providerSchema = z.enum(["runway", "luma", "sora", "other"]);

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: rawProvider } = await params;
  const provider = providerSchema.parse(rawProvider);
  const assets = await getAiProviderAdapter(provider).listGeneratedAssets("stub");
  return NextResponse.json({
    provider,
    assets,
    message:
      "These are scaffolded assets representing the import hand-off contract. Live provider listing is not implemented in v1.",
  });
}
