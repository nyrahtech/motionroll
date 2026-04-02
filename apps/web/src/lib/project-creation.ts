import { z } from "zod";

export const createProjectSourceSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("blank"),
  }),
  z.object({
    kind: z.literal("demo"),
    demoId: z.string().min(1),
  }),
]);

export const createProjectRequestSchema = z.object({
  source: createProjectSourceSchema,
  title: z.string().min(1).max(128).optional(),
});

export type CreateProjectSource = z.infer<typeof createProjectSourceSchema>;
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;
