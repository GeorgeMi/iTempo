import { setRequestLocale } from "next-intl/server";
import { listClients } from "@/lib/actions/clients";
import { listServices } from "@/lib/actions/services";
import { CalendarPage } from "./calendar-page";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [clients, services] = await Promise.all([listClients(), listServices()]);
  return <CalendarPage clients={clients} services={services} locale={locale} />;
}
