import { z } from "zod";
import { required } from "@/lib/validation";

// A10 user rules: the Admin's form checks these, and the server runs the same schemas before saving.

export const PASSWORD_MIN = 8;

const password = z.string().min(PASSWORD_MIN, "err.passwordShort");

/** Add (no id, password required) or edit (id; the password is changed separately). */
export const userSchema = z
  .object({
    id: z.string().optional(),
    name: required,
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, "err.required")
      .regex(/^[a-z0-9._-]+$/, "err.usernameChars"),
    phone: z.string().trim().default(""),
    role: z.enum(["farm", "admin"]),
    farmId: z.string().trim().optional(),
    active: z.boolean(),
    password: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === "farm" && !v.farmId) ctx.addIssue({ code: "custom", message: "err.pickFarm", path: ["farmId"] });
    if (!v.id && (v.password ?? "").length < PASSWORD_MIN) ctx.addIssue({ code: "custom", message: "err.passwordShort", path: ["password"] });
  })
  // An Admin belongs to no farm.
  .transform((v) => ({ ...v, farmId: v.role === "farm" ? v.farmId : undefined }));

export const passwordSchema = z.object({ password });

export type UserInput = z.input<typeof userSchema>;
