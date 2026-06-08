import { z } from "zod";

export const submitAppealSchema = z.object({
  message: z
    .string()
    .trim()
    .min(20, "Please explain your appeal in at least 20 characters.")
    .max(2000, "Appeal message is too long."),
});
