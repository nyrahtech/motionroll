import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import { env } from "@/lib/env";

export async function ensureTempDir(projectId: string, assetId: string) {
  const directory = path.resolve(env.PROCESSING_TEMP_DIR, projectId, assetId);
  await mkdir(directory, { recursive: true });
  return directory;
}

export async function extractVideoFrames(
  inputPath: string,
  outputDir: string,
  fps = 30,
) {
  await execa(env.FFMPEG_BINARY, [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `fps=${fps}`,
    path.join(outputDir, "frame-%05d.jpg"),
  ]);

  const frames = await readdir(outputDir);
  return frames
    .filter((file) => file.endsWith(".jpg"))
    .sort()
    .map((file) => path.join(outputDir, file));
}

export async function generatePoster(inputPath: string, outputPath: string) {
  await execa(env.FFMPEG_BINARY, [
    "-y",
    "-i",
    inputPath,
    "-vf",
    "select=eq(n\\,0)",
    "-q:v",
    "2",
    "-frames:v",
    "1",
    outputPath,
  ]);
}

export async function generateFallbackVideo(inputPath: string, outputPath: string) {
  await execa(env.FFMPEG_BINARY, [
    "-y",
    "-i",
    inputPath,
    "-vf",
    "scale=1280:-2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}

export async function generateFallbackVideoFromFrames(
  inputPattern: string,
  outputPath: string,
  fps = 12,
) {
  await execa(env.FFMPEG_BINARY, [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    inputPattern,
    "-vf",
    "scale=1280:-2",
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputPath,
  ]);
}
