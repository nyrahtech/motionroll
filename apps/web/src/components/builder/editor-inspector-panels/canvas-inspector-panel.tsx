"use client";

import React from "react";
import type { BackgroundVideoEndBehavior } from "@motionroll/shared";
import { Button } from "../../ui/button";
import { ColorPicker } from "../../ui/color-picker";
import { Input } from "../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../ui/select";
import type { SidebarPanelProps } from "../editor-sidebar";
import { Field, numberInputClassName, SectionLabel } from "../editor-inspector-primitives";

type CanvasInspectorPanelProps = Pick<
  SidebarPanelProps,
  | "canvasSettings"
  | "onCanvasFieldChange"
  | "onCanvasBackgroundColorChange"
  | "onCanvasBackgroundEndBehaviorChange"
  | "onDetachCanvasBackground"
  | "onRemoveCanvasBackground"
>;

export function CanvasInspectorPanel({
  canvasSettings,
  onCanvasFieldChange,
  onCanvasBackgroundColorChange,
  onCanvasBackgroundEndBehaviorChange,
  onDetachCanvasBackground,
  onRemoveCanvasBackground,
}: CanvasInspectorPanelProps) {
  if (!canvasSettings) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <SectionLabel>Canvas</SectionLabel>
        <Field label="Title">
          <Input aria-label="Project title" value={canvasSettings.title} readOnly />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Frame start">
            <Input
              aria-label="Frame range start"
              className={numberInputClassName}
              type="number"
              min="0"
              value={canvasSettings.frameRangeStart}
              onChange={(event) =>
                onCanvasFieldChange?.("frameRangeStart", Number(event.currentTarget.value))
              }
            />
          </Field>
          <Field label="Frame end">
            <Input
              aria-label="Frame range end"
              className={numberInputClassName}
              type="number"
              min="1"
              value={canvasSettings.frameRangeEnd}
              onChange={(event) =>
                onCanvasFieldChange?.("frameRangeEnd", Number(event.currentTarget.value))
              }
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Scroll height">
            <Input
              aria-label="Canvas scroll height"
              className={numberInputClassName}
              type="number"
              min="100"
              max="600"
              step="10"
              value={canvasSettings.scrollHeightVh}
              onChange={(event) =>
                onCanvasFieldChange?.("scrollHeightVh", Number(event.currentTarget.value))
              }
            />
          </Field>
          <Field label="Scrub strength">
            <Input
              aria-label="Canvas scrub strength"
              className={numberInputClassName}
              type="number"
              min="0.05"
              max="4"
              step="0.05"
              value={canvasSettings.scrubStrength}
              onChange={(event) =>
                onCanvasFieldChange?.("scrubStrength", Number(event.currentTarget.value))
              }
            />
          </Field>
        </div>
        <Field label="Background">
          <ColorPicker
            label="Canvas background"
            value={canvasSettings.backgroundColor ?? "#0a0a0b"}
            onCommitChange={(value) =>
              onCanvasFieldChange?.("backgroundColor", value) ??
              onCanvasBackgroundColorChange?.(value)
            }
          />
        </Field>
        {canvasSettings.backgroundMedia ? (
          <div className="space-y-2">
            <Field label="Background media">
              <Input
                aria-label="Canvas background media"
                value={canvasSettings.backgroundMedia.url}
                readOnly
              />
            </Field>
            <Field label="End Behavior">
              <Select
                value={canvasSettings.backgroundVideoEndBehavior ?? "loop"}
                onValueChange={(value) =>
                  onCanvasBackgroundEndBehaviorChange?.(value as BackgroundVideoEndBehavior)
                }
              >
                <SelectTrigger
                  aria-label="Canvas background end behavior"
                  className="rounded-[12px]"
                  size="default"
                >
                  <SelectValue placeholder="End behavior" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="loop">Loop</SelectItem>
                  <SelectItem value="hold">Hold Last Frame</SelectItem>
                  <SelectItem value="stop">Stop</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => onDetachCanvasBackground?.()}
              >
                Detach background
              </Button>
              <Button
                type="button"
                variant="quiet"
                size="sm"
                onClick={() => onRemoveCanvasBackground?.()}
              >
                Remove background
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
