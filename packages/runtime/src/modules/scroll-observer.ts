/**
 * scroll-observer — encapsulates scroll → progress mapping and IntersectionObserver logic.
 * Pure function surface; no side effects beyond attaching/removing event listeners.
 */
import { clampProgress } from "../../../shared/src/timing";

export type ScrollObserverOptions = {
  container: HTMLElement;
  onProgress: (progress: number) => void;
  onVisibilityChange?: (visible: boolean) => void;
  allowWheelScrub?: boolean;
};

export type ScrollObserverCleanup = () => void;

export function attachScrollObserver(options: ScrollObserverOptions): ScrollObserverCleanup {
  const { container, onProgress, onVisibilityChange, allowWheelScrub } = options;
  const cleanups: Array<() => void> = [];

  function syncScrollProgress() {
    const viewportHeight = typeof window !== "undefined" ? window.innerHeight : 0;
    const rect = container.getBoundingClientRect();
    const availableScrollDistance = Math.max(rect.height - viewportHeight, 1);
    const progress = clampProgress(-rect.top / availableScrollDistance);
    onProgress(progress);
  }

  // Passive scroll listener
  const onScroll = () => syncScrollProgress();
  window.addEventListener("scroll", onScroll, { passive: true });
  cleanups.push(() => window.removeEventListener("scroll", onScroll));

  // Wheel scrub (fine-grained control)
  if (allowWheelScrub) {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const availableDistance = Math.max(rect.height - (window.innerHeight || 0), 1);
      const delta = e.deltaY / availableDistance;
      const current = clampProgress(-rect.top / availableDistance);
      onProgress(clampProgress(current + delta));
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    cleanups.push(() => container.removeEventListener("wheel", onWheel));
  }

  // Intersection observer for visibility
  if (onVisibilityChange && typeof IntersectionObserver !== "undefined") {
    const observer = new IntersectionObserver(
      ([entry]) => {
        onVisibilityChange(entry?.isIntersecting ?? false);
      },
      { threshold: 0 },
    );
    observer.observe(container);
    cleanups.push(() => observer.disconnect());
  }

  // Resize
  if (typeof ResizeObserver !== "undefined") {
    const resizeObserver = new ResizeObserver(() => syncScrollProgress());
    resizeObserver.observe(container);
    cleanups.push(() => resizeObserver.disconnect());
  }

  // Initial sync
  syncScrollProgress();

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
