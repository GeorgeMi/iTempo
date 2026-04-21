import { getTranslations, setRequestLocale } from "next-intl/server";
import { listClients } from "@/lib/actions/clients";
import { ClientsPage } from "./clients-page";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("clients");
  const clients = await listClients({ includeArchived: true });
  return <ClientsPage clients={clients} title={t("title")} />;
}
