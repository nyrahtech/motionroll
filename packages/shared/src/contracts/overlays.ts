import { z } from "zod";

export const OverlayAlignSchema = z.enum(["start", "center", "end"]);
export type OverlayAlign = z.infer<typeof OverlayAlignSchema>;

export const OverlayThemeSchema = z.enum(["light", "dark", "accent"]);
export type OverlayTheme = z.infer<typeof OverlayThemeSchema>;

export const OverlayTreatmentSchema = z.enum(["default", "cinematic-pop"]);
export type OverlayTreatment = z.infer<typeof OverlayTreatmentSchema>;

export const ContentTypeSchema = z.enum(["text", "image", "logo", "icon"]);
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

export const AnimationPresetSchema = z.enum([
  "fade",
  "slide-up",
  "slide-down",
  "scale-in",
  "blur-in",
]);
export type AnimationPreset = z.infer<typeof AnimationPresetSchema>;

export const TransitionPresetSchema = z.enum([
  "fade",
  "crossfade",
  "wipe",
  "zoom-dissolve",
  "blur-dissolve",
]);
export type TransitionPreset = z.infer<typeof TransitionPresetSchema>;

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

export const OverlayAnimationSchema = z.object({
  preset: AnimationPresetSchema.default("fade"),
  easing: MotionEasingSchema.default("ease-out"),
  duration: z.number().min(0.08).max(2.5).default(0.45),
  delay: z.number().min(0).max(1.5).default(0),
});
export type OverlayAnimation = z.infer<typeof OverlayAnimationSchema>;

export const OverlayTransitionSchema = z.object({
  preset: TransitionPresetSchema.default("crossfade"),
  easing: MotionEasingSchema.default("ease-in-out"),
  duration: z.number().min(0.08).max(2.5).default(0.4),
});
export type OverlayTransition = z.infer<typeof OverlayTransitionSchema>;

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

export const OverlayContentSchema = z.object({
  type: ContentTypeSchema.optional(),
  eyebrow: z.string().min(1).optional(),
  headline: z.string().min(1),
  body: z.string().min(1),
  textHtml: z
    .object({
      eyebrow: z.string().min(1).optional(),
      headline: z.string().min(1).optional(),
      body: z.string().min(1).optional(),
    })
    .optional(),
  cta: CtaConfigSchema.optional(),
  align: OverlayAlignSchema.default("start"),
  theme: OverlayThemeSchema.default("light"),
  treatment: OverlayTreatmentSchema.default("default"),
  mediaUrl: z.string().min(1).optional(),
  linkHref: z.string().min(1).optional(),
  layout: OverlayLayoutSchema.optional(),
  style: OverlayStyleSchema.optional(),
  background: OverlayBackgroundSchema.optional(),
  animation: OverlayAnimationSchema.optional(),
  transition: OverlayTransitionSchema.optional(),
  layer: z.number().int().min(0).max(999).optional(),
});
export type OverlayContent = z.infer<typeof OverlayContentSchema>;

export const OverlayDefinitionSchema = z.object({
  id: z.string().min(1),
  timing: OverlayTimingSchema,
  content: OverlayContentSchema,
});
export type OverlayDefinition = z.infer<typeof OverlayDefinitionSchema>;
