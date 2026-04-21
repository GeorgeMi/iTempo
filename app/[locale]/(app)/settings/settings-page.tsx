"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { updateProfile, changePassword } from "@/lib/actions/settings";
import { useRouter } from "@/i18n/navigation";

type User = {
  id: string;
  email: string;
  name: string | null;
  currency: string;
  locale: string;
};

export function SettingsPage({ user }: { user: User }) {
  const t = useTranslations("settings");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [name, setName] = useState(user.name ?? "");
  const [currency, setCurrency] = useState(user.currency);
  const [locale, setLocale] = useState<"ro" | "en">((user.locale as "ro" | "en") ?? "ro");

  const saveProfile = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateProfile({ name, currency, locale });
        toast.success(t("saved"));
        router.refresh();
      } catch {
        toast.error("Error");
      }
    });
  };

  const submitPassword = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const payload = {
      currentPassword: String(fd.get("currentPassword") || ""),
      newPassword: String(fd.get("newPassword") || ""),
    };
    startTransition(async () => {
      try {
        await changePassword(payload);
        toast.success(t("saved"));
        (e.target as HTMLFormElement).reset();
      } catch (err) {
        if ((err as Error).message === "WRONG_PASSWORD") toast.error(t("currentPassword"));
        else toast.error("Error");
      }
    });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("profile")}</TabsTrigger>
          <TabsTrigger value="password">{t("changePassword")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="p-5">
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t("email")}</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">{t("name")}</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>{t("currency")}</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RON">RON (lei)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{t("language")}</Label>
                  <Select value={locale} onValueChange={(v) => setLocale(v as "ro" | "en")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ro">🇷🇴 Română</SelectItem>
                      <SelectItem value="en">🇬🇧 English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" disabled={isPending}>
                {t("save")}
              </Button>
            </form>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card className="p-5">
            <form onSubmit={submitPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{t("newPassword")}</Label>
                <Input
                  id="newPassword"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Button type="submit" disabled={isPending}>
                {t("save")}
              </Button>
            </form>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
