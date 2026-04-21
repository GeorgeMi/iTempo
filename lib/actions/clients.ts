"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/prisma";
import { clientSchema } from "@/lib/validators";

export async function listClients(opts: { includeArchived?: boolean } = {}) {
  const userId = await requireUserId();
  return prisma.client.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });
}

export async function createClient(input: unknown) {
  const userId = await requireUserId();
  const data = clientSchema.parse(input);
  const created = await prisma.client.create({
    data: {
      userId,
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      color: data.color,
      defaultRate: data.defaultRate ?? null,
    },
  });
  revalidatePath("/", "layout");
  return created;
}

export async function updateClient(id: string, input: unknown) {
  const userId = await requireUserId();
  const data = clientSchema.parse(input);
  const result = await prisma.client.updateMany({
    where: { id, userId },
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      notes: data.notes || null,
      color: data.color,
      defaultRate: data.defaultRate ?? null,
    },
  });
  if (result.count === 0) throw new Error("NOT_FOUND");
  revalidatePath("/", "layout");
}

export async function archiveClient(id: string, archived: boolean) {
  const userId = await requireUserId();
  await prisma.client.updateMany({ where: { id, userId }, data: { archived } });
  revalidatePath("/", "layout");
}

export async function deleteClient(id: string) {
  const userId = await requireUserId();
  await prisma.client.deleteMany({ where: { id, userId } });
  revalidatePath("/", "layout");
}
