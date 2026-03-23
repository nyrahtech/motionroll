"use client";

import React, { Component, type ReactNode } from "react";
import { serializeClientError } from "./client-error-log";

type Props = { children: ReactNode; fallbackTitle?: string };
type State = { error: Error | null; errorInfo: string };

class ErrorBoundaryBase extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error, errorInfo: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn("[MotionRoll Error Boundary]", {
      error: serializeClientError(error),
      componentStack: info.componentStack,
    });
    this.setState({ errorInfo: error.message });
  }

  handleCopy = () => {
    const text = `${this.state.error?.message ?? "Unknown error"}\n\n${this.state.error?.stack ?? ""}`;
    void navigator.clipboard.writeText(text).catch(() => undefined);
  };

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-4 p-8"
          style={{ background: "var(--editor-shell)", color: "var(--editor-text)" }}
        >
          <div
            className="w-full max-w-md rounded-xl border p-6"
            style={{ background: "var(--editor-panel)", borderColor: "var(--editor-border)" }}
          >
            <p
              className="mb-1 text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--editor-text-dim)" }}
            >
              {this.props.fallbackTitle ?? "Editor error"}
            </p>
            <p className="mb-4 text-sm" style={{ color: "var(--editor-text)" }}>
              Something went wrong. Your draft is saved locally and will be
              restored when you reload.
            </p>
            <code
              className="mb-4 block max-h-24 overflow-auto rounded p-3 text-xs"
              style={{
                background: "var(--editor-shell)",
                color: "#f87171",
                fontFamily: "IBM Plex Mono, monospace",
              }}
            >
              {this.state.errorInfo}
            </code>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded px-4 py-2 text-sm font-medium transition-opacity hover:opacity-90"
                style={{ background: "var(--editor-accent)", color: "#0a0a0b" }}
              >
                Reload editor
              </button>
              <button
                type="button"
                onClick={this.handleCopy}
                className="rounded border px-4 py-2 text-sm transition-colors hover:bg-[var(--editor-hover)]"
                style={{
                  borderColor: "var(--editor-border)",
                  color: "var(--editor-text-dim)",
                }}
              >
                Copy error
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Full-panel error boundary for the editor shell. */
export function EditorErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundaryBase fallbackTitle="Editor error">{children}</ErrorBoundaryBase>
  );
}

/** Minimal error boundary for the runtime preview. */
export function PreviewErrorBoundary({
  children,
  resetKey,
}: {
  children: ReactNode;
  resetKey?: number;
}) {
  // resetKey cycling unmounts + remounts the boundary to clear the error
  return (
    <PreviewBoundaryInner key={resetKey}>{children}</PreviewBoundaryInner>
  );
}

class PreviewBoundaryInner extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg p-6 text-center"
          style={{ background: "var(--editor-panel)", color: "var(--editor-text-dim)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--editor-text)" }}>
            Preview unavailable
          </p>
          <p className="max-w-xs text-xs">{this.state.error}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** Minimal error boundary for the timeline panel. */
export function TimelineErrorBoundary({ children }: { children: ReactNode }) {
  return <TimelineBoundaryInner>{children}</TimelineBoundaryInner>;
}

class TimelineBoundaryInner extends Component<{ children: ReactNode }, { error: string | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex h-full w-full items-center justify-center gap-3 px-6"
          style={{ background: "var(--editor-panel)", color: "var(--editor-text-dim)" }}
        >
          <p className="text-xs">Timeline error — try reloading</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded border px-3 py-1 text-xs transition-colors hover:bg-[var(--editor-hover)]"
            style={{ borderColor: "var(--editor-border)", color: "var(--editor-text)" }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
