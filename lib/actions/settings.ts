"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const profileSchema = z.object({
  name: z.string().optional().nullable(),
  currency: z.string().min(3).max(5),
  locale: z.enum(["ro", "en"]),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function updateProfile(input: unknown) {
  const userId = await requireUserId();
  const data = profileSchema.parse(input);
  await prisma.user.update({
    where: { id: userId },
    data: { name: data.name || null, currency: data.currency, locale: data.locale },
  });
  revalidatePath("/", "layout");
}

export async function changePassword(input: unknown) {
  const userId = await requireUserId();
  const data = passwordSchema.parse(input);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("NOT_FOUND");
  const ok = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!ok) throw new Error("WRONG_PASSWORD");
  const hash = await bcrypt.hash(data.newPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });
}
