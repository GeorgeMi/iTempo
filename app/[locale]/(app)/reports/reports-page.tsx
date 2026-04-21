"use client";
import { useTranslations } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatMoney, formatDuration } from "@/lib/utils";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  Legend,
} from "recharts";
import { Download } from "lucide-react";

type Bucket = { date: string; collected: number; due: number; upcoming: number };
type Agg = { name: string; color: string; realized: number; upcoming: number; count: number };

export function ReportsPage({
  locale,
  currency,
  period,
  collected,
  due,
  totalMinutes,
  count,
  estimatedRevenue,
  estimatedMinutes,
  upcomingCount,
  dailyData,
  byService,
  byClient,
  clients,
  services,
  selectedServiceId,
  selectedClientId,
}: {
  locale: string;
  currency: string;
  period: string;
  collected: number;
  due: number;
  totalMinutes: number;
  count: number;
  estimatedRevenue: number;
  estimatedMinutes: number;
  upcomingCount: number;
  dailyData: Bucket[];
  byService: Agg[];
  byClient: Agg[];
  clients: { id: string; name: string }[];
  services: { id: string; name: string }[];
  selectedServiceId: string;
  selectedClientId: string;
}) {
  const t = useTranslations("reports");
  const router = useRouter();
  const pathname = usePathname();

  const setParam = (k: string, v: string | null) => {
    const url = new URL(window.location.href);
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
    router.replace(pathname + (url.search || ""));
  };

  const exportCsv = () => {
    const header = ["date", "collected", "due", "upcoming", "total"];
    const rows = dailyData.map((b) => [
      b.date,
      b.collected,
      b.due,
      b.upcoming,
      b.collected + b.due + b.upcoming,
    ]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `itempo-report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const realizedTotal = collected + due;
  const expectedTotal = realizedTotal + estimatedRevenue;

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" />
          {t("export")}
        </Button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 sm:grid-cols-3">
        <FilterSelect
          label={t("period")}
          value={period}
          onChange={(v) => setParam("period", v)}
          options={[
            { value: "last30", label: t("last30") },
            { value: "thisMonth", label: t("thisMonth") },
            { value: "lastMonth", label: t("lastMonth") },
            { value: "thisYear", label: t("thisYear") },
          ]}
        />
        <FilterSelect
          label={t("byService")}
          value={selectedServiceId || "__all__"}
          onChange={(v) => setParam("serviceId", v === "__all__" ? null : v)}
          options={[
            { value: "__all__", label: t("allServices") },
            ...services.map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <FilterSelect
          label={t("byClient")}
          value={selectedClientId || "__all__"}
          onChange={(v) => setParam("clientId", v === "__all__" ? null : v)}
          options={[
            { value: "__all__", label: t("allClients") },
            ...clients.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>

      {/* Realized */}
      <section>
        <div className="label-xs mb-4">{t("realized") || "Realizat"}</div>
        <div className="grid gap-x-10 gap-y-6 border-y border-border py-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label={t("revenueCollected")} value={formatMoney(collected, currency)} tone="success" />
          <Metric
            label={t("revenueDue")}
            value={formatMoney(due, currency)}
            tone={due > 0 ? "warning" : undefined}
          />
          <Metric label={t("hoursWorked")} value={formatDuration(totalMinutes, locale)} />
          <Metric label={t("sessionsCount")} value={String(count)} />
        </div>
      </section>

      {/* Upcoming / Estimated */}
      <section>
        <div className="label-xs mb-4">{t("estimated") || "Urmează (estimat)"}</div>
        <div className="grid gap-x-10 gap-y-6 border-y border-border py-6 sm:grid-cols-3">
          <Metric
            label={t("revenueEstimated") || "Venit estimat"}
            value={formatMoney(estimatedRevenue, currency)}
            tone="muted"
          />
          <Metric
            label={t("hoursEstimated") || "Ore estimate"}
            value={formatDuration(estimatedMinutes, locale)}
            tone="muted"
          />
          <Metric
            label={t("sessionsUpcoming") || "Programări viitoare"}
            value={String(upcomingCount)}
            tone="muted"
          />
        </div>
        {expectedTotal > 0 && (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2 text-sm">
            <span className="label-xs">{t("projected") || "Proiecție perioadă"}</span>
            <span className="text-2xl font-medium tabular-nums tracking-tight">
              {formatMoney(expectedTotal, currency)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatMoney(realizedTotal, currency)} {t("realized") || "realizat"} +{" "}
              {formatMoney(estimatedRevenue, currency)} {t("estimated") || "estimat"}
            </span>
          </div>
        )}
      </section>

      {/* Revenue over time */}
      <section>
        <h2 className="mb-4 text-sm font-medium">{t("revenueOverTime")}</h2>
        <div className="h-72 rounded-lg border border-border bg-card p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cPaid" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(150 55% 45%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(150 55% 45%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cDue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(32 90% 50%)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(32 90% 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="cUpcoming" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(244 60% 58%)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="hsl(244 60% 58%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={(d) => d.slice(5)}
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={11}
                stroke="hsl(var(--muted-foreground))"
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => formatMoney(Number(v), currency)}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area
                type="monotone"
                dataKey="collected"
                name={t("revenueCollected")}
                stroke="hsl(150 55% 45%)"
                strokeWidth={1.5}
                fill="url(#cPaid)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="due"
                name={t("revenueDue")}
                stroke="hsl(32 90% 50%)"
                strokeWidth={1.5}
                fill="url(#cDue)"
                stackId="1"
              />
              <Area
                type="monotone"
                dataKey="upcoming"
                name={t("estimated") || "Estimated"}
                stroke="hsl(244 60% 58%)"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                fill="url(#cUpcoming)"
                stackId="1"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Breakdowns */}
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 text-sm font-medium">{t("byService")}</h2>
          <div className="h-72 rounded-lg border border-border bg-card p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byService} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} horizontal={false} />
                <XAxis
                  type="number"
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  fontSize={11}
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  formatter={(v) => formatMoney(Number(v), currency)}
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="realized" stackId="a" name={t("realized") || "Realizat"} radius={[0, 0, 0, 0]}>
                  {byService.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Bar>
                <Bar
                  dataKey="upcoming"
                  stackId="a"
                  name={t("estimated") || "Estimat"}
                  radius={[0, 4, 4, 0]}
                >
                  {byService.map((s, i) => (
                    <Cell key={i} fill={s.color} fillOpacity={0.35} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium">{t("byClient")}</h2>
          <ul className="divide-y divide-border border-y border-border">
            {byClient.map((c) => {
              const total = c.realized + c.upcoming;
              const realizedPct = total > 0 ? (c.realized / total) * 100 : 0;
              return (
                <li key={c.name} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      <span className="truncate text-sm">{c.name}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">({c.count})</span>
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatMoney(total, currency)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${realizedPct}%`,
                        backgroundColor: c.color,
                      }}
                    />
                    <div
                      className="-mt-1 h-full rounded-full opacity-40"
                      style={{
                        marginLeft: `${realizedPct}%`,
                        width: `${100 - realizedPct}%`,
                        backgroundColor: c.color,
                      }}
                    />
                  </div>
                </li>
              );
            })}
            {byClient.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">—</p>}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "warning" | "muted";
}) {
  return (
    <div>
      <div className="label-xs">{label}</div>
      <div
        className={
          "mt-2 text-3xl font-medium tracking-tight tabular-nums " +
          (tone === "success"
            ? "text-success"
            : tone === "warning"
            ? "text-warning"
            : tone === "muted"
            ? "text-muted-foreground"
            : "")
        }
      >
        {value}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <label className="label-xs">{label}</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
