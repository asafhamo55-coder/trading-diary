import { z } from "zod";

export const homeAccountTypeSchema = z.enum([
  "BOFA_CHECKING",
  "BOFA_CARD",
  "AMEX",
  "OTHER",
]);
export const homeCategoryKindSchema = z.enum(["SPENDING", "INCOME", "TRANSFER"]);

export const createHomeAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  type: homeAccountTypeSchema,
  last4: z.string().max(4).optional().nullable(),
});
export const updateHomeAccountSchema = createHomeAccountSchema
  .partial()
  .extend({ archived: z.boolean().optional() });

export const createHomeCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(60),
  parentId: z.string().optional().nullable(),
  kind: homeCategoryKindSchema.optional(),
  color: z.string().max(9).optional().nullable(),
});
export const updateHomeCategorySchema = createHomeCategorySchema.partial();

export const createHomeTransactionSchema = z.object({
  homeAccountId: z.string().min(1, "Account is required"),
  date: z.string().min(1, "Date is required"),
  // Signed amount: negative = money out, positive = money in.
  amount: z.number().refine((n) => n !== 0, "Amount can't be zero"),
  description: z.string().min(1, "Description is required").max(200),
  categoryId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  isExcluded: z.boolean().optional(),
  excludeReason: z.string().max(120).optional().nullable(),
});

export const updateHomeTransactionSchema = z.object({
  date: z.string().optional(),
  amount: z.number().optional(),
  description: z.string().max(200).optional(),
  categoryId: z.string().optional().nullable(),
  propertyId: z.string().optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
  isExcluded: z.boolean().optional(),
  excludeReason: z.string().max(120).optional().nullable(),
  needsReview: z.boolean().optional(),
});

// Batch save from the ledger: a list of per-row patches applied together.
export const bulkHomeTransactionSchema = z.object({
  updates: z
    .array(
      z.object({
        id: z.string().min(1),
        categoryId: z.string().optional().nullable(),
        propertyId: z.string().optional().nullable(),
        isExcluded: z.boolean().optional(),
        excludeReason: z.string().max(120).optional().nullable(),
        notes: z.string().max(500).optional().nullable(),
      })
    )
    .min(1)
    .max(4000),
});

export type CreateHomeAccountInput = z.infer<typeof createHomeAccountSchema>;
export type CreateHomeCategoryInput = z.infer<typeof createHomeCategorySchema>;
export type CreateHomeTransactionInput = z.infer<typeof createHomeTransactionSchema>;
