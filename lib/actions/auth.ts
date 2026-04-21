"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signUpSchema } from "@/lib/validators";
import { signIn } from "@/auth";

export async function signUpAction(_prev: unknown, formData: FormData) {
  if (process.env.ALLOW_SIGNUP === "false") {
    return { error: "signupDisabled" as const };
  }
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    name: formData.get("name") || undefined,
  });
  if (!parsed.success) {
    return { error: "validation" as const, issues: parsed.error.flatten().fieldErrors };
  }
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });
  if (existing) return { error: "emailTaken" as const };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.create({
    data: {
      email: parsed.data.email.toLowerCase(),
      passwordHash,
      name: parsed.data.name,
    },
  });
  await signIn("credentials", {
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
  return { error: null };
}

export async function signInAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") || "");
  const password = String(formData.get("password") || "");
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return { error: null };
  } catch (err) {
    // next-auth v5 throws redirect "errors" on success; rethrow those
    if ((err as { digest?: string }).digest?.includes("NEXT_REDIRECT")) throw err;
    return { error: "invalidCredentials" as const };
  }
}
