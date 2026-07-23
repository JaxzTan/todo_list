import { z } from "zod";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const createBoardSchema = z.object({
  slug: z.string().min(1).max(80).regex(SLUG, "slug must be lowercase kebab-case"),
  type: z.enum(["PROJECT", "DAY"]),
  title: z.string().min(1).max(200),
  goal: z.string().min(1).max(2000),
  dateKey: z.string().regex(DATE_ONLY).optional(),
  deadline: z.string().regex(DATE_ONLY).optional(),
});
export type CreateBoardInput = z.infer<typeof createBoardSchema>;

export const addNodeSchema = z.object({
  parentId: z.string().nullable().optional(),
  kind: z.enum(["GROUP", "STEP"]),
  title: z.string().min(1).max(500),
  doneCondition: z.string().max(1000).optional(),
  reason: z.string().max(500).optional(),
});
export type AddNodeInput = z.infer<typeof addNodeSchema>;

export const blockerInputSchema = z.object({
  description: z.string().min(1).max(1000),
  unblockPlan: z.string().max(1000).optional(),
});

export const patchNodeSchema = z
  .object({
    status: z.enum(["todo", "doing", "stuck", "done", "skipped"]).optional(),
    title: z.string().min(1).max(500).optional(),
    reason: z.string().max(500).optional(),
    due: z.string().regex(DATE_ONLY).nullable().optional(),
    prio: z.enum(["high", "med", "low"]).nullable().optional(),
    owner: z.string().max(100).nullable().optional(),
    quadrant: z.enum(["do_now", "schedule", "delegate", "drop"]).nullable().optional(),
    doneCondition: z.string().max(1000).nullable().optional(),
    archived: z.boolean().optional(),
    blocker: blockerInputSchema.optional(),
    source: z.enum(["INFERRED", "EXPLICIT", "IMPORT", "SYSTEM"]).optional(),
    ambiguous: z.boolean().optional(),
  })
  .refine((v) => v.status !== "stuck" || v.blocker !== undefined, {
    message: "blocker is required when status is set to stuck",
    path: ["blocker"],
  })
  .refine((v) => v.title === undefined || v.reason !== undefined, {
    message: "reason is required when rewording a step (TR-10)",
    path: ["reason"],
  })
  .refine((v) => v.archived !== true || v.reason !== undefined, {
    message: "reason is required when cutting a step (TR-10)",
    path: ["reason"],
  });
export type PatchNodeInput = z.infer<typeof patchNodeSchema>;

export const addNoteSchema = z.object({ body: z.string().min(1).max(5000) });
export type AddNoteInput = z.infer<typeof addNoteSchema>;

export const sessionActionSchema = z.object({ action: z.enum(["open", "close"]) });
export type SessionActionInput = z.infer<typeof sessionActionSchema>;

export const importBoardSchema = z.object({
  slug: z.string().min(1).max(80).regex(SLUG, "slug must be lowercase kebab-case"),
  // §7: markdown import is untrusted input and size-capped — 1MB is
  // generous for a "days to weeks" board (PRD §8 assumption) and cheap
  // enough to reject before it reaches the parser.
  markdown: z.string().min(1).max(1_000_000),
});
export type ImportBoardInput = z.infer<typeof importBoardSchema>;
