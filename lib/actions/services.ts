"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/prisma";
import { serviceSchema } from "@/lib/validators";

export async function listServices(opts: { includeArchived?: boolean } = {}) {
  const userId = await requireUserId();
  return prisma.service.findMany({
    where: { userId, ...(opts.includeArchived ? {} : { archived: false }) },
    orderBy: [{ archived: "asc" }, { name: "asc" }],
  });
}

export async function createService(input: unknown) {
  const userId = await requireUserId();
  const data = serviceSchema.parse(input);
  const created = await prisma.service.create({
    data: {
      userId,
      name: data.name,
      defaultDuration: data.defaultDuration,
      defaultPrice: data.defaultPrice,
      color: data.color,
    },
  });
  revalidatePath("/", "layout");
  return created;
}

export async function updateService(id: string, input: unknown) {
  const userId = await requireUserId();
  const data = serviceSchema.parse(input);
  const result = await prisma.service.updateMany({
    where: { id, userId },
    data: {
      name: data.name,
      defaultDuration: data.defaultDuration,
      defaultPrice: data.defaultPrice,
      color: data.color,
    },
  });
  if (result.count === 0) throw new Error("NOT_FOUND");
  revalidatePath("/", "layout");
}

export async function archiveService(id: string, archived: boolean) {
  const userId = await requireUserId();
  await prisma.service.updateMany({ where: { id, userId }, data: { archived } });
  revalidatePath("/", "layout");
}

export async function deleteService(id: string) {
  const userId = await requireUserId();
  try {
    await prisma.service.deleteMany({ where: { id, userId } });
  } catch {
    // fall back to archive if referenced (SQLite restrict)
    await prisma.service.updateMany({ where: { id, userId }, data: { archived: true } });
  }
  revalidatePath("/", "layout");
}
