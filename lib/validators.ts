import { z } from "zod";

export const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Min 8 characters"),
  name: z.string().min(1).optional(),
});

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const clientSchema = z.object({
  name: z.string().min(1, "Required"),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal("")).nullable(),
  notes: z.string().optional().nullable(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  defaultRate: z.coerce.number().nonnegative().optional().nullable(),
});

export const serviceSchema = z.object({
  name: z.string().min(1, "Required"),
  defaultDuration: z.coerce.number().int().min(5).max(600),
  defaultPrice: z.coerce.number().nonnegative(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});

export const appointmentSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  price: z.coerce.number().nonnegative(),
  status: z.enum(["SCHEDULED", "DONE", "CANCELLED", "NO_SHOW"]),
  paid: z.boolean(),
  notes: z.string().optional().nullable(),
});

export const recurringRuleSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY"]),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional().nullable(),
  startTimeMinutes: z.coerce.number().int().min(0).max(24 * 60 - 1),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  price: z.coerce.number().nonnegative(),
  startsOn: z.coerce.date(),
  endsOn: z.coerce.date().optional().nullable(),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type RecurringRuleInput = z.infer<typeof recurringRuleSchema>;
