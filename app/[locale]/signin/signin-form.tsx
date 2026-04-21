"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signInAction } from "@/lib/actions/auth";

export function SignInForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signInAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {state?.error === "invalidCredentials" && (
        <p className="text-sm text-destructive">{t("invalidCredentials")}</p>
      )}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {t("submitSignIn")}
      </Button>
    </form>
  );
}
