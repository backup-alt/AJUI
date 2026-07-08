import { z } from "zod";

export const phoneSchema = z
  .string()
  .trim()
  .min(8, "Phone must be at least 8 characters")
  .max(20, "Phone too long")
  .regex(/^[\d+\-\s()]+$/, "Invalid phone format");

export const passwordSchema = z
  .string()
  .min(6, "Password must be at least 6 characters")
  .max(128, "Password too long");

export const emailSchema = z.string().email("Invalid email").trim().toLowerCase();

export const loginSchema = z.object({
  body: z.object({
    identifier: z.string().trim().min(3, "Email or phone is required").optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    password: passwordSchema,
  }).refine(
    (data) => !!(data.identifier || data.phone || data.email),
    { message: "Email or phone is required", path: ["identifier"] }
  ),
});

export const refreshSchema = z.object({
  body: z.object({}).optional(),
});

export const logoutSchema = z.object({
  body: z.object({}).optional(),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema,
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: passwordSchema,
  }),
});

export const verifyInviteSchema = z.object({
  params: z.object({
    token: z.string().min(1),
  }),
});

export const supervisorSignupSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    otp: z.string().length(6, "OTP must be 6 digits"),
    name: z.string().trim().min(2).max(100),
    phone: phoneSchema,
    email: emailSchema,
    password: passwordSchema,
  }),
});

export type LoginInput = z.infer<typeof loginSchema>["body"];
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>["body"];
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>["body"];
export type SupervisorSignupInput = z.infer<typeof supervisorSignupSchema>["body"];
