import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { SignInForm } from "./signin-form";

export default async function SignInPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  if (session?.user) redirect(`/${locale}/dashboard`);
  const t = await getTranslations("auth");
  const tApp = await getTranslations("app");

  return (
    <div className="min-h-dvh grid place-items-center p-4 bg-background">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-10 text-center">
          <div className="mb-6 text-xs font-medium tracking-[0.2em] text-muted-foreground uppercase">
            · {tApp("name")}
          </div>
          <h1 className="text-2xl font-medium tracking-tight">{t("welcomeBack")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{tApp("tagline")}</p>
        </div>
        <SignInForm />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            {t("signUp")}
          </Link>
        </p>
      </div>
    </div>
  );
}
