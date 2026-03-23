/**
 * useEditorPlayback — owns playback state (play/pause) and the RAF loop
 * that advances the playhead during playback.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { clampProgress } from "@motionroll/shared";

export type UseEditorPlaybackReturn = {
  isPlaying: boolean;
  playhead: number;
  playheadRef: React.MutableRefObject<number>;
  setPlayhead: (value: number) => void;
  togglePlay: () => void;
  stopPlay: () => void;
  seekPlayhead: (value: number) => void;
};

export function useEditorPlayback(durationSeconds: number): UseEditorPlaybackReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayheadState] = useState(0.24);
  const playheadRef = useRef(0.24);
  const playbackRafRef = useRef<number | null>(null);
  const playbackLastTickRef = useRef<number | null>(null);

  // Keep ref in sync
  useEffect(() => {
    playheadRef.current = playhead;
  }, [playhead]);

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
      setPlayheadState(nextPlayhead);

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
    setPlayheadState(value);
  }, []);

  const seekPlayhead = useCallback((value: number) => {
    const next = clampProgress(value);
    setIsPlaying(false);
    playheadRef.current = next;
    setPlayheadState(next);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((current) => !current);
  }, []);

  const stopPlay = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return {
    isPlaying,
    playhead,
    playheadRef,
    setPlayhead,
    togglePlay,
    stopPlay,
    seekPlayhead,
  };
}
