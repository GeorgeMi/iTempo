import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Calendar, Repeat, Wallet } from "lucide-react";

export default async function Landing({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user) redirect(`/${locale}/dashboard`);
  const t = await getTranslations("landing");
  const tApp = await getTranslations("app");

  return (
    <div className="min-h-dvh bg-background">
      <header className="container flex items-center justify-between py-6">
        <div className="flex items-center gap-1.5 font-semibold tracking-tight">
          <span className="text-primary">·</span>
          {tApp("name")}
        </div>
        <div className="flex gap-1">
          <Button asChild variant="ghost" size="sm">
            <Link href="/signin">{t("ctaSignIn")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">{t("ctaStart")}</Link>
          </Button>
        </div>
      </header>

      <main className="container">
        <section className="mx-auto max-w-3xl pt-24 pb-24 text-center animate-fade-in">
          <h1 className="text-4xl font-medium tracking-[-0.03em] sm:text-5xl md:text-6xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            {t("heroSub")}
          </p>
          <div className="mt-10 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/signup">{t("ctaStart")}</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/signin">{t("ctaSignIn")}</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto grid max-w-4xl gap-6 border-t border-border pt-12 pb-20 sm:grid-cols-3">
          <Feature icon={<Calendar />} title={t("f1Title")} desc={t("f1Desc")} />
          <Feature icon={<Repeat />} title={t("f2Title")} desc={t("f2Desc")} />
          <Feature icon={<Wallet />} title={t("f3Title")} desc={t("f3Desc")} />
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {tApp("name")}
      </footer>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="px-1">
      <div className="flex h-9 w-9 items-center justify-center rounded-md text-primary">{icon}</div>
      <h3 className="mt-3 font-medium tracking-tight">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
