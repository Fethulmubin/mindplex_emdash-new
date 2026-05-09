import { z } from "astro/zod";

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  username: z.string().min(3),
});

export const ActivateSchema = z.object({
  token: z.string().min(1),
});

export const SocialSchema = z.object({
  idToken: z.string().min(1),
  provider: z.literal("google"),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type ActivateInput = z.infer<typeof ActivateSchema>;
export type SocialInput = z.infer<typeof SocialSchema>;
export type RefreshInput = z.infer<typeof RefreshSchema>;
