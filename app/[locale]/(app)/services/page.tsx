import { getTranslations, setRequestLocale } from "next-intl/server";
import { listServices } from "@/lib/actions/services";
import { ServicesPage } from "./services-page";

export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("services");
  const services = await listServices({ includeArchived: true });
  return <ServicesPage services={services} title={t("title")} />;
}
