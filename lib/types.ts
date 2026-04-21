export type AppointmentStatus = "SCHEDULED" | "DONE" | "CANCELLED" | "NO_SHOW";
export type RecurrenceFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "DONE",
  "CANCELLED",
  "NO_SHOW",
];

export const RECURRENCE_FREQUENCIES: RecurrenceFrequency[] = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
];
