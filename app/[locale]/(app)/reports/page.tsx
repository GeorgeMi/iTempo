import { setRequestLocale } from "next-intl/server";
import { subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { expandOccurrences } from "@/lib/recurrence";
import { ReportsPage } from "./reports-page";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string; serviceId?: string; clientId?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const session = await auth();
  const userId = session!.user.id;
  const currency = session!.user.currency;

  const now = new Date();
  const period = sp.period ?? "thisMonth";
  const { from, to } = resolvePeriod(period, now);

  const [rules, appointments, clients, services] = await Promise.all([
    prisma.recurringRule.findMany({ where: { userId, active: true } }),
    prisma.appointment.findMany({
      where: {
        userId,
        OR: [{ startAt: { gte: from, lte: to } }, { recurringRuleId: { not: null } }],
      },
    }),
    prisma.client.findMany({ where: { userId }, select: { id: true, name: true, color: true } }),
    prisma.service.findMany({ where: { userId }, select: { id: true, name: true, color: true } }),
  ]);

  const occurrences = expandOccurrences(rules, appointments, from, to).filter((o) => {
    if (sp.serviceId && o.serviceId !== sp.serviceId) return false;
    if (sp.clientId && o.clientId !== sp.clientId) return false;
    return true;
  });

  // Split: done (realized) vs upcoming (future/expected)
  const done = occurrences.filter((o) => o.materialized?.status === "DONE");
  const upcoming = occurrences.filter((o) => {
    if (o.materialized?.status === "DONE") return false;
    if (o.materialized?.status === "CANCELLED") return false;
    if (o.materialized?.status === "NO_SHOW") return false;
    return o.startAt > now; // truly in the future
  });

  const collected = done.filter((o) => o.materialized?.paid).reduce((a, o) => a + o.price, 0);
  const due = done.filter((o) => !o.materialized?.paid).reduce((a, o) => a + o.price, 0);
  const totalMinutesDone = done.reduce(
    (a, o) => a + (o.endAt.getTime() - o.startAt.getTime()) / 60_000,
    0,
  );

  const estimatedRevenue = upcoming.reduce((a, o) => a + o.price, 0);
  const estimatedMinutes = upcoming.reduce(
    (a, o) => a + (o.endAt.getTime() - o.startAt.getTime()) / 60_000,
    0,
  );

  // Daily buckets (local date), two series: realized vs scheduled
  const dailyMap = new Map<
    string,
    { collected: number; due: number; upcoming: number }
  >();
  const addBucket = (d: Date, key: "collected" | "due" | "upcoming", amount: number) => {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const prev = dailyMap.get(k) ?? { collected: 0, due: 0, upcoming: 0 };
    prev[key] += amount;
    dailyMap.set(k, prev);
  };
  for (const o of done) {
    addBucket(o.startAt, o.materialized?.paid ? "collected" : "due", o.price);
  }
  for (const o of upcoming) {
    addBucket(o.startAt, "upcoming", o.price);
  }
  const dailyData = Array.from(dailyMap.entries())
    .sort()
    .map(([date, v]) => ({ date, ...v }));

  // Breakdown by service — combined done + upcoming
  const serviceMap = new Map<
    string,
    { name: string; color: string; realized: number; upcoming: number; count: number }
  >();
  for (const o of [...done, ...upcoming]) {
    const s = services.find((x) => x.id === o.serviceId);
    if (!s) continue;
    const prev =
      serviceMap.get(s.id) ?? { name: s.name, color: s.color, realized: 0, upcoming: 0, count: 0 };
    if (o.materialized?.status === "DONE") prev.realized += o.price;
    else prev.upcoming += o.price;
    prev.count += 1;
    serviceMap.set(s.id, prev);
  }
  const byService = Array.from(serviceMap.values()).sort(
    (a, b) => b.realized + b.upcoming - (a.realized + a.upcoming),
  );

  // Breakdown by client
  const clientMap = new Map<
    string,
    { name: string; color: string; realized: number; upcoming: number; count: number }
  >();
  for (const o of [...done, ...upcoming]) {
    const c = clients.find((x) => x.id === o.clientId);
    if (!c) continue;
    const prev =
      clientMap.get(c.id) ?? { name: c.name, color: c.color, realized: 0, upcoming: 0, count: 0 };
    if (o.materialized?.status === "DONE") prev.realized += o.price;
    else prev.upcoming += o.price;
    prev.count += 1;
    clientMap.set(c.id, prev);
  }
  const byClient = Array.from(clientMap.values())
    .sort((a, b) => b.realized + b.upcoming - (a.realized + a.upcoming))
    .slice(0, 10);

  return (
    <ReportsPage
      locale={locale}
      currency={currency}
      period={period}
      collected={collected}
      due={due}
      totalMinutes={Math.round(totalMinutesDone)}
      count={done.length}
      estimatedRevenue={estimatedRevenue}
      estimatedMinutes={Math.round(estimatedMinutes)}
      upcomingCount={upcoming.length}
      dailyData={dailyData}
      byService={byService}
      byClient={byClient}
      clients={clients}
      services={services}
      selectedServiceId={sp.serviceId ?? ""}
      selectedClientId={sp.clientId ?? ""}
    />
  );
}

function resolvePeriod(p: string, now: Date) {
  if (p === "last30") return { from: startOfDay(subDays(now, 30)), to: endOfDay(now) };
  if (p === "lastMonth") {
    const prev = subMonths(now, 1);
    return { from: startOfMonth(prev), to: endOfMonth(prev) };
  }
  if (p === "thisYear")
    return { from: startOfYear(now), to: new Date(now.getFullYear(), 11, 31, 23, 59, 59) };
  // thisMonth — full month window so upcoming sessions are included
  return { from: startOfMonth(now), to: endOfMonth(now) };
}
