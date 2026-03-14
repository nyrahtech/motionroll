import { NextResponse } from "next/server";
import { presetDefinitions } from "@motionroll/shared";

export async function GET() {
  return NextResponse.json(presetDefinitions);
}

