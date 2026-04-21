import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { SessionProvider } from "next-auth/react";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (!session?.user?.email) redirect(`/${locale}/signin`);

  return (
    <SessionProvider session={session}>
      <AppShell userEmail={session.user.email}>{children}</AppShell>
    </SessionProvider>
  );
}
