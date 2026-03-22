import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InlineTextToolbar } from "./inline-text-toolbar";

describe("inline text toolbar", () => {
  it("renders icon actions with accessible labels after tooltip wrapping", () => {
    const markup = renderToStaticMarkup(
      <InlineTextToolbar
        position={{ top: 0, left: 0 }}
        isTextStyle
        canGroup
        canUngroup
        onChange={() => undefined}
        onGroup={() => undefined}
        onUngroup={() => undefined}
        onDuplicate={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(markup).toContain('aria-label="Bold"');
    expect(markup).toContain('title="Bold"');
    expect(markup).toContain('aria-label="Italic"');
    expect(markup).toContain('title="Italic"');
    expect(markup).toContain('aria-label="Underline"');
    expect(markup).toContain('title="Underline"');
    expect(markup).toContain('aria-label="Align left"');
    expect(markup).toContain('title="Align left"');
    expect(markup).toContain('aria-label="Align center"');
    expect(markup).toContain('title="Align center"');
    expect(markup).toContain('aria-label="Align right"');
    expect(markup).toContain('title="Align right"');
    expect(markup).toContain('aria-label="Group selected items"');
    expect(markup).toContain('title="Group selected items"');
    expect(markup).toContain('aria-label="Ungroup selected item"');
    expect(markup).toContain('title="Ungroup selected item"');
    expect(markup).toContain('aria-label="Duplicate"');
    expect(markup).toContain('title="Duplicate"');
    expect(markup).toContain('aria-label="Delete"');
    expect(markup).toContain('title="Delete"');
  });
});
