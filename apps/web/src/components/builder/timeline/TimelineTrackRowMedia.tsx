"use client";

import React, { useEffect, useState } from "react";

const bookmarkVideoStripCache = new Map<string, string[]>();

export function TimelineVideoStrip({
  url,
  posterUrl,
  durationMs,
  sampleCount,
}: {
  url: string;
  posterUrl?: string;
  durationMs?: number;
  sampleCount: number;
}) {
  const cacheKey = `${url}|${sampleCount}`;
  const [frames, setFrames] = useState<string[]>(() => bookmarkVideoStripCache.get(cacheKey) ?? []);

  useEffect(() => {
    const cached = bookmarkVideoStripCache.get(cacheKey);
    if (cached) {
      setFrames(cached);
      return;
    }

    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    const finalize = (nextFrames: string[]) => {
      if (cancelled) {
        return;
      }
      bookmarkVideoStripCache.set(cacheKey, nextFrames);
      setFrames(nextFrames);
    };

    const handleFailure = () => {
      finalize(posterUrl ? Array.from({ length: sampleCount }, () => posterUrl) : []);
    };

    const captureFrames = async () => {
      if (!context) {
        handleFailure();
        return;
      }

      const width = Math.max(video.videoWidth, 160);
      const height = Math.max(video.videoHeight, 90);
      canvas.width = width;
      canvas.height = height;

      const durationSeconds =
        Number.isFinite(video.duration) && video.duration > 0
          ? video.duration
          : typeof durationMs === "number" && durationMs > 0
            ? durationMs / 1000
            : 0;

      if (durationSeconds <= 0) {
        handleFailure();
        return;
      }

      const maxTime = Math.max(durationSeconds - 0.05, 0);
      const sampleTimes = Array.from({ length: sampleCount }, (_, index) =>
        sampleCount <= 1 ? 0 : (maxTime * index) / (sampleCount - 1),
      );

      const nextFrames: string[] = [];

      for (const sampleTime of sampleTimes) {
        if (cancelled) {
          return;
        }

        await new Promise<void>((resolve) => {
          const handleSeeked = () => {
            video.removeEventListener("seeked", handleSeeked);
            resolve();
          };
          video.addEventListener("seeked", handleSeeked, { once: true });
          video.currentTime = sampleTime;
        });

        if (cancelled) {
          return;
        }

        context.drawImage(video, 0, 0, width, height);
        nextFrames.push(canvas.toDataURL("image/jpeg", 0.72));
      }

      finalize(nextFrames);
    };

    video.addEventListener("loadeddata", () => {
      void captureFrames().catch(handleFailure);
    }, { once: true });
    video.addEventListener("error", handleFailure, { once: true });

    return () => {
      cancelled = true;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [cacheKey, durationMs, posterUrl, sampleCount, url]);

  if (frames.length === 0) {
    return (
      <div
        className="h-full w-full"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 50%, rgba(0,0,0,0.08) 100%)",
        }}
      />
    );
  }

  return (
    <div className="flex h-full overflow-hidden rounded-md">
      {frames.map((frame, index) => (
        <img
          key={`${frame}-${index}`}
          src={frame}
          alt=""
          className="h-full flex-1 object-cover opacity-90"
          draggable={false}
        />
      ))}
    </div>
  );
}

export function TimelineStripImage({
  url,
  fallbackUrl,
}: {
  url: string;
  fallbackUrl?: string;
}) {
  const [src, setSrc] = useState(url);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setSrc(url);
    setHidden(false);
  }, [url]);

  return (
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover opacity-90"
      draggable={false}
      style={hidden ? { visibility: "hidden" } : undefined}
      onError={() => {
        if (!hidden && fallbackUrl && src !== fallbackUrl) {
          setSrc(fallbackUrl);
          return;
        }
        setHidden(true);
      }}
    />
  );
}
