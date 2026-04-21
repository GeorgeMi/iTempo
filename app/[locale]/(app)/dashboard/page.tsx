import { getTranslations, setRequestLocale } from "next-intl/server";
import { startOfDay, endOfDay, addDays, startOfMonth, endOfMonth } from "date-fns";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { expandOccurrences } from "@/lib/recurrence";
import { formatMoney, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();
  const userId = session!.user.id;
  const currency = session!.user.currency;
  const t = await getTranslations("dashboard");

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);

  const [rules, appointmentsMonth, clients, services] = await Promise.all([
    prisma.recurringRule.findMany({ where: { userId, active: true } }),
    prisma.appointment.findMany({
      where: {
        userId,
        OR: [{ startAt: { gte: monthStart, lte: monthEnd } }, { recurringRuleId: { not: null } }],
      },
    }),
    prisma.client.findMany({ where: { userId }, select: { id: true, name: true, color: true } }),
    prisma.service.findMany({ where: { userId }, select: { id: true, name: true, color: true } }),
  ]);

  const clientsMap = new Map(clients.map((c) => [c.id, c]));
  const servicesMap = new Map(services.map((s) => [s.id, s]));

  const monthOccurrences = expandOccurrences(rules, appointmentsMonth, monthStart, monthEnd);
  const todayOccurrences = monthOccurrences.filter(
    (o) => o.startAt >= todayStart && o.startAt <= todayEnd && o.materialized?.status !== "CANCELLED",
  );
  const upcoming = monthOccurrences
    .filter(
      (o) => o.startAt > now && o.startAt <= addDays(now, 7) && o.materialized?.status !== "CANCELLED",
    )
    .slice(0, 6);

  const doneMonth = monthOccurrences.filter((o) => o.materialized?.status === "DONE");
  const monthRevenueCollected = doneMonth
    .filter((o) => o.materialized?.paid)
    .reduce((acc, o) => acc + o.price, 0);
  const monthRevenueDue = doneMonth
    .filter((o) => !o.materialized?.paid)
    .reduce((acc, o) => acc + o.price, 0);
  const monthHoursMinutes = doneMonth.reduce(
    (acc, o) => acc + (o.endAt.getTime() - o.startAt.getTime()) / 60_000,
    0,
  );

  const unpaidPast = await prisma.appointment.findMany({
    where: { userId, status: "DONE", paid: false },
    orderBy: { startAt: "desc" },
    take: 8,
  });

  const greetName = session?.user?.name ? `, ${session.user.name}` : "";

  return (
    <div className="space-y-10">
      <header>
        <div className="label-xs">{new Date().toLocaleDateString(locale, { weekday: "long", day: "2-digit", month: "long" })}</div>
        <h1 className="mt-1 text-3xl font-medium tracking-tight">
          {t("title")}{greetName}
        </h1>
      </header>

      <section className="grid gap-x-10 gap-y-6 border-y border-border py-6 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label={t("monthRevenue")}
          value={formatMoney(monthRevenueCollected, currency)}
          sub={monthRevenueDue > 0 ? `+ ${formatMoney(monthRevenueDue, currency)} ${t("unpaid").toLowerCase()}` : undefined}
          subTone={monthRevenueDue > 0 ? "warning" : undefined}
        />
        <Metric label={t("monthHours")} value={formatDuration(Math.round(monthHoursMinutes), locale)} />
        <Metric label={t("todayLabel")} value={String(todayOccurrences.length)} />
        <Metric
          label={t("unpaid")}
          value={String(unpaidPast.length)}
          tone={unpaidPast.length > 0 ? "warning" : undefined}
        />
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-medium">{t("todayLabel")}</h2>
            <Link href="/calendar" className="text-xs text-muted-foreground hover:text-foreground">
              Calendar →
            </Link>
          </div>
          {todayOccurrences.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">{t("noneToday")}</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {todayOccurrences.map((o) => (
                <OccurrenceRow
                  key={(o.materialized?.id ?? o.recurringRuleId) + o.startAt.toISOString()}
                  client={clientsMap.get(o.clientId)}
                  service={servicesMap.get(o.serviceId)}
                  start={o.startAt}
                  end={o.endAt}
                  paid={!!o.materialized?.paid}
                  done={o.materialized?.status === "DONE"}
                  price={o.price}
                  currency={currency}
                />
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-sm font-medium">{t("unpaid")}</h2>
            <Link href="/reports" className="text-xs text-muted-foreground hover:text-foreground">
              →
            </Link>
          </div>
          {unpaidPast.length === 0 ? (
            <p className="py-10 text-sm text-muted-foreground">{t("unpaidNone")}</p>
          ) : (
            <ul className="divide-y divide-border border-y border-border">
              {unpaidPast.map((a) => {
                const c = clientsMap.get(a.clientId);
                const s = servicesMap.get(a.serviceId);
                return (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: c?.color ?? "#64748b" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{c?.name ?? "?"}</div>
                      <div className="text-xs text-muted-foreground">
                        {s?.name} · {a.startAt.toLocaleDateString(locale)}
                      </div>
                    </div>
                    <span className="text-sm tabular-nums text-warning">
                      {formatMoney(a.price, currency)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {upcoming.length > 0 && (
        <section>
          <h2 className="mb-4 text-sm font-medium">{t("upcoming")}</h2>
          <ul className="divide-y divide-border border-y border-border">
            {upcoming.map((o) => (
              <OccurrenceRow
                key={o.recurringRuleId + o.startAt.toISOString()}
                client={clientsMap.get(o.clientId)}
                service={servicesMap.get(o.serviceId)}
                start={o.startAt}
                end={o.endAt}
                paid={!!o.materialized?.paid}
                done={o.materialized?.status === "DONE"}
                price={o.price}
                currency={currency}
                showDate
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  subTone,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  subTone?: "warning";
  tone?: "warning";
}) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div
        className={
          "mt-2 text-3xl font-medium tracking-tight tabular-nums " +
          (tone === "warning" ? "text-warning" : "")
        }
      >
        {value}
      </div>
      {sub && (
        <div className={"mt-1 text-xs " + (subTone === "warning" ? "text-warning" : "text-muted-foreground")}>
          {sub}
        </div>
      )}
    </div>
  );
}

function OccurrenceRow({
  client,
  service,
  start,
  end,
  paid,
  done,
  price,
  currency,
  showDate,
}: {
  client?: { name: string; color: string };
  service?: { name: string; color: string };
  start: Date;
  end: Date;
  paid: boolean;
  done: boolean;
  price: number;
  currency: string;
  showDate?: boolean;
}) {
  const startStr = start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const endStr = end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const dateStr = start.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
  return (
    <li className="flex items-center gap-3 py-3">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: client?.color ?? "#64748b" }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">
          {client?.name ?? "?"}
          <span className="text-muted-foreground"> · {service?.name}</span>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground">
          {showDate && <>{dateStr} · </>}
          {startStr}–{endStr}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums">{formatMoney(price, currency)}</span>
        {done &&
          (paid ? (
            <Badge variant="success" className="px-1.5 py-0 text-[10px]">
              ✓
            </Badge>
          ) : (
            <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
              !
            </Badge>
          ))}
      </div>
    </li>
  );
}
