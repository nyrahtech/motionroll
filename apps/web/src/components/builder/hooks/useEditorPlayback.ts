/**
 * useEditorPlayback — owns playback state (play/pause) and the RAF loop
 * that advances the playhead during playback.
 */
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { clampProgress } from "@motionroll/shared";

export type EditorPlaybackController = {
  subscribe: (listener: () => void) => () => void;
  getPlayhead: () => number;
};

export type UseEditorPlaybackReturn = {
  isPlaying: boolean;
  playback: EditorPlaybackController;
  playheadRef: React.MutableRefObject<number>;
  setPlayhead: (value: number) => void;
  togglePlay: () => void;
  stopPlay: () => void;
  seekPlayhead: (value: number) => void;
};

export function usePlaybackProgress(playback: EditorPlaybackController) {
  return useSyncExternalStore(
    playback.subscribe,
    playback.getPlayhead,
    playback.getPlayhead,
  );
}

export function useEditorPlayback(durationSeconds: number): UseEditorPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const playheadRef = useRef(0.24);
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastTickRef = useRef<number | null>(null);
  const listenersRef = useRef(new Set<() => void>());

  const notifyPlayheadSubscribers = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  // RAF loop
  useEffect(() => {
    if (!isPlaying) {
      if (playbackRafRef.current != null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      playbackLastTickRef.current = null;
      return;
    }

    const step = (timestamp: number) => {
      if (playbackLastTickRef.current == null) {
        playbackLastTickRef.current = timestamp;
      }
      const deltaMs = timestamp - playbackLastTickRef.current;
      playbackLastTickRef.current = timestamp;
      const progressDelta = deltaMs / Math.max(durationSeconds * 1000, 1);
      const nextPlayhead = clampProgress(playheadRef.current + progressDelta);
      playheadRef.current = nextPlayhead;
      notifyPlayheadSubscribers();

      if (nextPlayhead >= 1) {
        playbackRafRef.current = null;
        playbackLastTickRef.current = null;
        setIsPlaying(false);
        return;
      }

      playbackRafRef.current = window.requestAnimationFrame(step);
    };

    playbackRafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (playbackRafRef.current != null) {
        window.cancelAnimationFrame(playbackRafRef.current);
        playbackRafRef.current = null;
      }
      playbackLastTickRef.current = null;
    };
  }, [durationSeconds, isPlaying]);

  const setPlayhead = useCallback((value: number) => {
    playheadRef.current = value;
    notifyPlayheadSubscribers();
  }, [notifyPlayheadSubscribers]);

  const seekPlayhead = useCallback((value: number) => {
    const next = clampProgress(value);
    setIsPlaying(false);
    playheadRef.current = next;
    notifyPlayheadSubscribers();
  }, [notifyPlayheadSubscribers]);

  const togglePlay = useCallback(() => {
    setIsPlaying((current) => !current);
  }, []);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const playback = useMemo<EditorPlaybackController>(
    () => ({
      subscribe(listener) {
        listenersRef.current.add(listener);
        return () => {
          listenersRef.current.delete(listener);
        };
      },
      getPlayhead() {
        return playheadRef.current;
      },
    }),
    [],
  );

  return {
    isPlaying,
    playback,
    playheadRef,
    setPlayhead,
    togglePlay,
    stopPlay,
    seekPlayhead,
  };
}
