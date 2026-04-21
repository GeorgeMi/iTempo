"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/prisma";
import { appointmentSchema, recurringRuleSchema } from "@/lib/validators";
import { expandOccurrences } from "@/lib/recurrence";

export async function getDayOccurrences(dateISO: string) {
  const userId = await requireUserId();
  const date = new Date(dateISO);
  const from = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0);
  const to = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

  const [rules, appointments, clients, services] = await Promise.all([
    prisma.recurringRule.findMany({ where: { userId, active: true } }),
    prisma.appointment.findMany({
      where: {
        userId,
        OR: [{ startAt: { gte: from, lte: to } }, { recurringRuleId: { not: null } }],
      },
    }),
    prisma.client.findMany({ where: { userId }, select: { id: true, name: true, color: true } }),
    prisma.service.findMany({ where: { userId }, select: { id: true, name: true } }),
  ]);

  const occurrences = expandOccurrences(rules, appointments, from, to);
  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const servicesMap = new Map(services.map((s) => [s.id, s]));

  return occurrences.map((o) => ({
    startAt: o.startAt.toISOString(),
    endAt: o.endAt.toISOString(),
    appointmentId: o.materialized?.id ?? null,
    recurringRuleId: o.recurringRuleId || null,
    originalStart: o.originalStart.toISOString(),
    clientId: o.clientId,
    clientName: clientsMap.get(o.clientId)?.name ?? "?",
    clientColor: clientsMap.get(o.clientId)?.color ?? "#64748b",
    serviceName: servicesMap.get(o.serviceId)?.name ?? "",
    status: o.materialized?.status ?? "SCHEDULED",
  }));
}

export async function getOccurrences(fromISO: string, toISO: string) {
  const userId = await requireUserId();
  const from = new Date(fromISO);
  const to = new Date(toISO);

  const [rules, appointments, clients, services] = await Promise.all([
    prisma.recurringRule.findMany({
      where: { userId, active: true },
    }),
    prisma.appointment.findMany({
      where: {
        userId,
        OR: [
          { startAt: { gte: from, lte: to } },
          { recurringRuleId: { not: null } },
        ],
      },
    }),
    prisma.client.findMany({
      where: { userId, archived: false },
      select: { id: true, name: true, color: true },
    }),
    prisma.service.findMany({
      where: { userId, archived: false },
      select: { id: true, name: true, color: true, defaultDuration: true },
    }),
  ]);

  const occurrences = expandOccurrences(rules, appointments, from, to);

  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const servicesMap = new Map(services.map((s) => [s.id, s]));

  return occurrences.map((o) => ({
    ...o,
    startAt: o.startAt.toISOString(),
    endAt: o.endAt.toISOString(),
    originalStart: o.originalStart.toISOString(),
    materialized: o.materialized
      ? {
          ...o.materialized,
          startAt: o.materialized.startAt.toISOString(),
          endAt: o.materialized.endAt.toISOString(),
          originalStart: o.materialized.originalStart
            ? o.materialized.originalStart.toISOString()
            : null,
        }
      : undefined,
    client: clientsMap.get(o.clientId),
    service: servicesMap.get(o.serviceId),
  }));
}

async function assertOwns(userId: string, ids: { clientId: string; serviceId: string }) {
  const [client, service] = await Promise.all([
    prisma.client.findFirst({ where: { id: ids.clientId, userId } }),
    prisma.service.findFirst({ where: { id: ids.serviceId, userId } }),
  ]);
  if (!client || !service) throw new Error("INVALID_REF");
}

// Create single appointment OR appointment + recurring rule
export async function createAppointment(input: {
  appointment: unknown;
  recurrence?: {
    frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    endsOn?: string | null;
  } | null;
}) {
  const userId = await requireUserId();
  const a = appointmentSchema.parse(input.appointment);
  await assertOwns(userId, { clientId: a.clientId, serviceId: a.serviceId });

  if (input.recurrence) {
    const durationMinutes = Math.round((a.endAt.getTime() - a.startAt.getTime()) / 60_000);
    const rule = await prisma.recurringRule.create({
      data: {
        userId,
        clientId: a.clientId,
        serviceId: a.serviceId,
        frequency: input.recurrence.frequency,
        dayOfWeek: a.startAt.getDay(),
        dayOfMonth: input.recurrence.frequency === "MONTHLY" ? a.startAt.getDate() : null,
        startTimeMinutes: a.startAt.getHours() * 60 + a.startAt.getMinutes(),
        durationMinutes,
        price: a.price,
        startsOn: a.startAt,
        endsOn: input.recurrence.endsOn ? new Date(input.recurrence.endsOn) : null,
      },
    });
    revalidatePath("/", "layout");
    return { ruleId: rule.id };
  } else {
    const created = await prisma.appointment.create({
      data: {
        userId,
        clientId: a.clientId,
        serviceId: a.serviceId,
        startAt: a.startAt,
        endAt: a.endAt,
        price: a.price,
        status: a.status,
        paid: a.paid,
        paidAt: a.paid ? new Date() : null,
        notes: a.notes || null,
      },
    });
    revalidatePath("/", "layout");
    return { appointmentId: created.id };
  }
}

// Materialize a virtual occurrence (derived from a rule) into a concrete appointment
// so it can be edited / cancelled without affecting the series.
export async function materializeOccurrence(args: {
  ruleId: string;
  originalStart: string;
  overrides?: Partial<{
    startAt: string;
    endAt: string;
    price: number;
    status: "SCHEDULED" | "DONE" | "CANCELLED" | "NO_SHOW";
    paid: boolean;
    notes: string | null;
  }>;
}) {
  const userId = await requireUserId();
  const rule = await prisma.recurringRule.findFirst({
    where: { id: args.ruleId, userId },
  });
  if (!rule) throw new Error("NOT_FOUND");

  const originalStart = new Date(args.originalStart);
  const defaultEnd = new Date(originalStart.getTime() + rule.durationMinutes * 60_000);

  const existing = await prisma.appointment.findFirst({
    where: {
      userId,
      recurringRuleId: rule.id,
      originalStart,
    },
  });

  if (existing) {
    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        ...(args.overrides?.startAt ? { startAt: new Date(args.overrides.startAt) } : {}),
        ...(args.overrides?.endAt ? { endAt: new Date(args.overrides.endAt) } : {}),
        ...(args.overrides?.price !== undefined ? { price: args.overrides.price } : {}),
        ...(args.overrides?.status ? { status: args.overrides.status } : {}),
        ...(args.overrides?.paid !== undefined
          ? { paid: args.overrides.paid, paidAt: args.overrides.paid ? new Date() : null }
          : {}),
        ...(args.overrides?.notes !== undefined ? { notes: args.overrides.notes } : {}),
      },
    });
    revalidatePath("/", "layout");
    return updated;
  }

  const created = await prisma.appointment.create({
    data: {
      userId,
      clientId: rule.clientId,
      serviceId: rule.serviceId,
      recurringRuleId: rule.id,
      originalStart,
      startAt: args.overrides?.startAt ? new Date(args.overrides.startAt) : originalStart,
      endAt: args.overrides?.endAt ? new Date(args.overrides.endAt) : defaultEnd,
      price: args.overrides?.price ?? rule.price,
      status: args.overrides?.status ?? "SCHEDULED",
      paid: args.overrides?.paid ?? false,
      paidAt: args.overrides?.paid ? new Date() : null,
      notes: args.overrides?.notes ?? null,
    },
  });
  revalidatePath("/", "layout");
  return created;
}

export async function updateAppointment(id: string, input: unknown) {
  const userId = await requireUserId();
  const data = appointmentSchema.parse(input);
  const prev = await prisma.appointment.findFirst({ where: { id, userId } });
  if (!prev) throw new Error("NOT_FOUND");
  await prisma.appointment.update({
    where: { id },
    data: {
      clientId: data.clientId,
      serviceId: data.serviceId,
      startAt: data.startAt,
      endAt: data.endAt,
      price: data.price,
      status: data.status,
      paid: data.paid,
      paidAt: data.paid && !prev.paid ? new Date() : !data.paid ? null : prev.paidAt,
      notes: data.notes || null,
    },
  });
  revalidatePath("/", "layout");
}

export async function togglePaid(id: string, paid: boolean) {
  const userId = await requireUserId();
  const result = await prisma.appointment.updateMany({
    where: { id, userId },
    data: { paid, paidAt: paid ? new Date() : null },
  });
  if (result.count === 0) throw new Error("NOT_FOUND");
  revalidatePath("/", "layout");
}

export async function setStatus(id: string, status: "SCHEDULED" | "DONE" | "CANCELLED" | "NO_SHOW") {
  const userId = await requireUserId();
  await prisma.appointment.updateMany({ where: { id, userId }, data: { status } });
  revalidatePath("/", "layout");
}

export async function deleteAppointment(id: string) {
  const userId = await requireUserId();
  await prisma.appointment.deleteMany({ where: { id, userId } });
  revalidatePath("/", "layout");
}

export async function deleteRecurringRule(ruleId: string) {
  const userId = await requireUserId();
  await prisma.recurringRule.deleteMany({ where: { id: ruleId, userId } });
  revalidatePath("/", "layout");
}

export async function updateRecurringRule(ruleId: string, input: unknown) {
  const userId = await requireUserId();
  const data = recurringRuleSchema.parse(input);
  await prisma.recurringRule.updateMany({
    where: { id: ruleId, userId },
    data: {
      clientId: data.clientId,
      serviceId: data.serviceId,
      frequency: data.frequency,
      dayOfWeek: data.dayOfWeek,
      dayOfMonth: data.dayOfMonth ?? null,
      startTimeMinutes: data.startTimeMinutes,
      durationMinutes: data.durationMinutes,
      price: data.price,
      startsOn: data.startsOn,
      endsOn: data.endsOn ?? null,
    },
  });
  revalidatePath("/", "layout");
}

// Drag-drop helper: move an occurrence to a new start time.
// If it's a materialized appointment, update it. If it's virtual (from a rule),
// materialize it as an exception.
export async function moveOccurrence(args: {
  appointmentId?: string | null;
  ruleId?: string | null;
  originalStart?: string | null;
  newStart: string;
  newEnd: string;
}) {
  const userId = await requireUserId();
  if (args.appointmentId) {
    await prisma.appointment.updateMany({
      where: { id: args.appointmentId, userId },
      data: { startAt: new Date(args.newStart), endAt: new Date(args.newEnd) },
    });
    revalidatePath("/", "layout");
    return;
  }
  if (args.ruleId && args.originalStart) {
    await materializeOccurrence({
      ruleId: args.ruleId,
      originalStart: args.originalStart,
      overrides: {
        startAt: args.newStart,
        endAt: args.newEnd,
      },
    });
    return;
  }
  throw new Error("BAD_ARGS");
}
