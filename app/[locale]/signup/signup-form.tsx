"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { signUpAction } from "@/lib/actions/auth";

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signUpAction, { error: null });

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" type="text" autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("password")}</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="text-xs text-muted-foreground">{t("passwordMin")}</p>
      </div>
      {state?.error === "emailTaken" && <p className="text-sm text-destructive">{t("emailTaken")}</p>}
      {state?.error === "signupDisabled" && <p className="text-sm text-destructive">{t("signupDisabled")}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {t("submitSignUp")}
      </Button>
    </form>
  );
}
