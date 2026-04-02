import { z } from "zod";

export const OverlayAlignSchema = z.enum(["start", "center", "end"]);
export type OverlayAlign = z.infer<typeof OverlayAlignSchema>;

export const OverlayThemeSchema = z.enum(["light", "dark", "accent"]);
export type OverlayTheme = z.infer<typeof OverlayThemeSchema>;

export const OverlayTreatmentSchema = z.enum(["default", "cinematic-pop"]);
export type OverlayTreatment = z.infer<typeof OverlayTreatmentSchema>;

export const ContentTypeSchema = z.enum(["text", "image", "logo", "icon", "group"]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

export const FontFamilySchema = z.enum([
  "Inter",
  "Manrope",
  "DM Sans",
  "Space Grotesk",
  "Instrument Sans",
  "Cormorant Garamond",
]);
export type FontFamily = z.infer<typeof FontFamilySchema>;

export const TextTransformSchema = z.enum(["none", "uppercase", "lowercase", "capitalize"]);
export type TextTransform = z.infer<typeof TextTransformSchema>;

export const BackgroundModeSchema = z.enum(["transparent", "solid"]);
export type BackgroundMode = z.infer<typeof BackgroundModeSchema>;

export const OverlayBlendModeSchema = z.enum(["normal", "screen", "add"]);
export type OverlayBlendMode = z.infer<typeof OverlayBlendModeSchema>;

export const OverlayMediaKindSchema = z.enum(["image", "video"]);
export type OverlayMediaKind = z.infer<typeof OverlayMediaKindSchema>;

export const OverlayMediaMetadataSchema = z.object({
  kind: OverlayMediaKindSchema.optional(),
  mimeType: z.string().min(1).optional(),
  contentType: z.string().min(1).optional(),
});
export type OverlayMediaMetadata = z.infer<typeof OverlayMediaMetadataSchema>;

export const OverlayPlaybackModeSchema = z.enum(["normal", "loop", "scroll-scrub"]);
export type OverlayPlaybackMode = z.infer<typeof OverlayPlaybackModeSchema>;

export const OverlayAnimationTypeSchema = z.enum([
  "none",
  "fade",
  "slide-up-fade",
  "slide-left-fade",
  "scale-fade",
]);
export type OverlayAnimationType = z.infer<typeof OverlayAnimationTypeSchema>;

const LegacyAnimationPresetSchema = z.enum([
  "fade",
  "slide-up",
  "slide-down",
  "scale-in",
  "blur-in",
]);

const LegacyTransitionPresetSchema = z.enum([
  "fade",
  "crossfade",
  "wipe",
  "zoom-dissolve",
  "blur-dissolve",
]);

export const MotionEasingSchema = z.enum([
  "linear",
  "ease-out",
  "ease-in-out",
  "back-out",
  "expo-out",
]);
export type MotionEasing = z.infer<typeof MotionEasingSchema>;

export const OverlayLayoutSchema = z.object({
  x: z.number().min(0).max(1).default(0.08),
  y: z.number().min(0).max(1).default(0.12),
  width: z.number().min(120).max(1600).default(420),
  height: z.number().min(48).max(1200).optional(),
});
export type OverlayLayout = z.infer<typeof OverlayLayoutSchema>;

export const OverlayStyleSchema = z.object({
  fontFamily: FontFamilySchema.default("Inter"),
  fontWeight: z.number().int().min(300).max(800).default(600),
  fontSize: z.number().min(12).max(120).default(34),
  lineHeight: z.number().min(0.8).max(2.4).default(1.08),
  letterSpacing: z.number().min(-0.08).max(0.3).default(0),
  textAlign: OverlayAlignSchema.default("start"),
  color: z.string().default("#f6f7fb"),
  opacity: z.number().min(0).max(1).default(1),
  maxWidth: z.number().min(140).max(1400).default(420),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  textTransform: TextTransformSchema.default("none"),
  buttonLike: z.boolean().default(false),
});
export type OverlayStyle = z.infer<typeof OverlayStyleSchema>;

export const OverlayBackgroundSchema = z.object({
  enabled: z.boolean().default(false),
  mode: BackgroundModeSchema.default("transparent"),
  color: z.string().default("#0d1016"),
  opacity: z.number().min(0).max(1).default(0.82),
  radius: z.number().min(0).max(64).default(14),
  paddingX: z.number().min(0).max(96).default(18),
  paddingY: z.number().min(0).max(96).default(14),
  borderColor: z.string().default("#d6f6ff"),
  borderOpacity: z.number().min(0).max(1).default(0),
});
export type OverlayBackground = z.infer<typeof OverlayBackgroundSchema>;

export const OverlayEnterAnimationSchema = z.object({
  type: OverlayAnimationTypeSchema.default("fade"),
  easing: MotionEasingSchema.default("ease-out"),
  duration: z.number().min(0.08).max(2.5).default(0.45),
  delay: z.number().min(0).max(1.5).default(0),
});
export type OverlayEnterAnimation = z.infer<typeof OverlayEnterAnimationSchema>;

export const OverlayExitAnimationSchema = z.object({
  type: OverlayAnimationTypeSchema.default("none"),
  easing: MotionEasingSchema.default("ease-in-out"),
  duration: z.number().min(0.08).max(2.5).default(0.35),
});
export type OverlayExitAnimation = z.infer<typeof OverlayExitAnimationSchema>;

export const CtaConfigSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});
export type CtaConfig = z.infer<typeof CtaConfigSchema>;

export const OverlayTimingSchema = z.object({
  start: z.number().min(0).max(1),
  end: z.number().min(0).max(1),
});
export type OverlayTiming = z.infer<typeof OverlayTimingSchema>;

export const OverlayTimingSourceSchema = z.enum(["sceneRange", "manual"]);
export type OverlayTimingSource = z.infer<typeof OverlayTimingSourceSchema>;

function joinLegacyTextParts(parts: Array<string | undefined>) {
  const values = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return values.length > 0 ? values.join("\n\n") : undefined;
}

function joinLegacyHtmlParts(parts: Array<string | undefined>) {
  const values = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  return values.length > 0 ? values.join("<br><br>") : undefined;
}

const LegacyTextHtmlSchema = z.object({
  eyebrow: z.string().min(1).optional(),
  headline: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
});

const OverlayStyleInputSchema = z.object({
  fontFamily: FontFamilySchema.default("Inter"),
  fontWeight: z.number().int().min(300).max(800).default(600),
  fontSize: z.number().min(12).max(120).optional(),
  eyebrowFontSize: z.number().min(8).max(60).optional(),
  bodyFontSize: z.number().min(8).max(72).optional(),
  lineHeight: z.number().min(0.8).max(2.4).default(1.08),
  letterSpacing: z.number().min(-0.08).max(0.3).default(0),
  textAlign: OverlayAlignSchema.default("start"),
  color: z.string().default("#f6f7fb"),
  opacity: z.number().min(0).max(1).default(1),
  maxWidth: z.number().min(140).max(1400).default(420),
  italic: z.boolean().default(false),
  underline: z.boolean().default(false),
  textTransform: TextTransformSchema.default("none"),
  buttonLike: z.boolean().default(false),
});

const OverlayContentInputSchema = z.object({
  type: ContentTypeSchema.optional(),
  text: z.string().min(1).optional(),
  textHtml: z.union([z.string().min(1), LegacyTextHtmlSchema]).optional(),
  eyebrow: z.string().min(1).optional(),
  headline: z.string().min(1).optional(),
  body: z.string().min(1).optional(),
  cta: CtaConfigSchema.optional(),
  align: OverlayAlignSchema.default("start"),
  theme: OverlayThemeSchema.default("light"),
  treatment: OverlayTreatmentSchema.default("default"),
  mediaUrl: z.string().min(1).optional(),
  mediaAssetId: z.string().min(1).optional(),
  mediaPreviewUrl: z.string().min(1).optional(),
  mediaMetadata: OverlayMediaMetadataSchema.optional(),
  playbackMode: OverlayPlaybackModeSchema.default("normal"),
  blendMode: OverlayBlendModeSchema.default("normal"),
  linkHref: z.string().min(1).optional(),
  layout: OverlayLayoutSchema.optional(),
  style: OverlayStyleInputSchema.optional(),
  background: OverlayBackgroundSchema.optional(),
  enterAnimation: OverlayEnterAnimationSchema.optional(),
  exitAnimation: OverlayExitAnimationSchema.optional(),
  animation: z.object({
    preset: LegacyAnimationPresetSchema.default("fade"),
    easing: MotionEasingSchema.default("ease-out"),
    duration: z.number().min(0.08).max(2.5).default(0.45),
    delay: z.number().min(0).max(1.5).default(0),
  }).optional(),
  transition: z.object({
    preset: LegacyTransitionPresetSchema.default("crossfade"),
    easing: MotionEasingSchema.default("ease-in-out"),
    duration: z.number().min(0.08).max(2.5).default(0.4),
  }).optional(),
  layer: z.number().int().min(0).max(999).optional(),
  parentGroupId: z.string().min(1).optional(),
});

type OverlayContentInput = z.input<typeof OverlayContentInputSchema>;

function mapLegacyEnterAnimationType(
  preset: z.infer<typeof LegacyAnimationPresetSchema> | undefined,
): OverlayAnimationType | undefined {
  switch (preset) {
    case "fade":
      return "fade";
    case "slide-up":
      return "slide-up-fade";
    case "scale-in":
      return "scale-fade";
    case "slide-down":
    case "blur-in":
      return "fade";
    default:
      return undefined;
  }
}

function mapLegacyExitAnimationType(
  preset: z.infer<typeof LegacyTransitionPresetSchema> | undefined,
): OverlayAnimationType | undefined {
  switch (preset) {
    case "fade":
    case "crossfade":
    case "wipe":
    case "blur-dissolve":
      return "fade";
    case "zoom-dissolve":
      return "scale-fade";
    default:
      return undefined;
  }
}

function normalizeEnterAnimation(content: OverlayContentInput): OverlayEnterAnimation {
  if (content.enterAnimation) {
    return OverlayEnterAnimationSchema.parse(content.enterAnimation);
  }

  return OverlayEnterAnimationSchema.parse({
    type: mapLegacyEnterAnimationType(content.animation?.preset) ?? "fade",
    easing: content.animation?.easing ?? "ease-out",
    duration: content.animation?.duration ?? 0.45,
    delay: content.animation?.delay ?? 0,
  });
}

function normalizeExitAnimation(content: OverlayContentInput): OverlayExitAnimation {
  if (content.exitAnimation) {
    return OverlayExitAnimationSchema.parse(content.exitAnimation);
  }

  return OverlayExitAnimationSchema.parse({
    type: mapLegacyExitAnimationType(content.transition?.preset) ?? "none",
    easing: content.transition?.easing ?? "ease-in-out",
    duration: content.transition?.duration ?? 0.35,
  });
}

export const OverlayContentSchema = OverlayContentInputSchema.transform((content) => {
  const normalizedText =
    content.text?.trim() ||
    joinLegacyTextParts([content.eyebrow, content.headline, content.body]);
  const normalizedHtml =
    typeof content.textHtml === "string"
      ? content.textHtml
      : joinLegacyHtmlParts([
          content.textHtml?.eyebrow,
          content.textHtml?.headline,
          content.textHtml?.body,
        ]);

  return {
    ...(content.type ? { type: content.type } : {}),
    ...(normalizedText ? { text: normalizedText } : {}),
    ...(normalizedHtml ? { textHtml: normalizedHtml } : {}),
    ...(content.cta ? { cta: content.cta } : {}),
    align: content.align,
    theme: content.theme,
    treatment: content.treatment,
    ...(content.mediaUrl ? { mediaUrl: content.mediaUrl } : {}),
    ...(content.mediaAssetId ? { mediaAssetId: content.mediaAssetId } : {}),
    ...(content.mediaPreviewUrl ? { mediaPreviewUrl: content.mediaPreviewUrl } : {}),
    ...(content.mediaMetadata ? { mediaMetadata: content.mediaMetadata } : {}),
    playbackMode: content.playbackMode,
    blendMode: content.blendMode,
    ...(content.linkHref ? { linkHref: content.linkHref } : {}),
    ...(content.layout ? { layout: content.layout } : {}),
    ...(content.style
      ? {
          style: {
            fontFamily: content.style.fontFamily,
            fontWeight: content.style.fontWeight,
            fontSize:
              content.style.fontSize ??
              content.style.bodyFontSize ??
              content.style.eyebrowFontSize ??
              34,
            lineHeight: content.style.lineHeight,
            letterSpacing: content.style.letterSpacing,
            textAlign: content.style.textAlign,
            color: content.style.color,
            opacity: content.style.opacity,
            maxWidth: content.style.maxWidth,
            italic: content.style.italic,
            underline: content.style.underline,
            textTransform: content.style.textTransform,
            buttonLike: content.style.buttonLike,
          },
        }
      : {}),
    ...(content.background ? { background: content.background } : {}),
    enterAnimation: normalizeEnterAnimation(content),
    exitAnimation: normalizeExitAnimation(content),
    ...(typeof content.layer === "number" ? { layer: content.layer } : {}),
    ...(content.parentGroupId ? { parentGroupId: content.parentGroupId } : {}),
  };
});
export type OverlayContent = {
  type?: ContentType;
  text?: string;
  textHtml?: string;
  cta?: CtaConfig;
  align: OverlayAlign;
  theme: OverlayTheme;
  treatment: OverlayTreatment;
  mediaUrl?: string;
  mediaAssetId?: string;
  mediaPreviewUrl?: string;
  mediaMetadata?: OverlayMediaMetadata;
  playbackMode: OverlayPlaybackMode;
  blendMode: OverlayBlendMode;
  linkHref?: string;
  layout?: OverlayLayout;
  style?: OverlayStyle;
  background?: OverlayBackground;
  enterAnimation: OverlayEnterAnimation;
  exitAnimation: OverlayExitAnimation;
  layer?: number;
  parentGroupId?: string;
};

export const OverlayDefinitionSchema = z.object({
  id: z.string().min(1),
  timing: OverlayTimingSchema,
  timingSource: OverlayTimingSourceSchema.default("manual"),
  content: OverlayContentSchema,
});
export type OverlayDefinition = {
  id: string;
  timing: OverlayTiming;
  timingSource: OverlayTimingSource;
  content: OverlayContent;
};
