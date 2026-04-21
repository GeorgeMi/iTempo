"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOccurrences, moveOccurrence } from "@/lib/actions/appointments";
import { AppointmentDialog, type AppointmentDialogInput } from "@/components/calendar/appointment-dialog";
import type { FullCalendarMountPoint } from "@/components/calendar/calendar-client-mount";

const CalendarClientMount = dynamic(
  () => import("@/components/calendar/calendar-client-mount").then((m) => m.CalendarClientMount),
  { ssr: false, loading: () => <CalendarSkeleton /> },
);

type Client = { id: string; name: string; color: string; defaultRate: number | null };
type Service = { id: string; name: string; color: string; defaultDuration: number; defaultPrice: number };

export function CalendarPage({
  clients,
  services,
  locale,
}: {
  clients: Client[];
  services: Service[];
  locale: string;
}) {
  const t = useTranslations("calendar");
  const [occurrences, setOccurrences] = useState<Awaited<ReturnType<typeof getOccurrences>>>([]);
  const [range, setRange] = useState<{ from: Date; to: Date } | null>(null);
  const [dialog, setDialog] = useState<AppointmentDialogInput | null>(null);
  const mountRef = useRef<FullCalendarMountPoint>(null);

  const refresh = async (from: Date, to: Date) => {
    try {
      const data = await getOccurrences(from.toISOString(), to.toISOString());
      setOccurrences(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (range) refresh(range.from, range.to);
  }, [range]);

  const events = useMemo(
    () =>
      occurrences.map((o) => {
        const cancelled = o.materialized?.status === "CANCELLED";
        const done = o.materialized?.status === "DONE";
        const paid = !!o.materialized?.paid;
        const bg = o.client?.color ?? "#6366f1";
        const classes = ["itempo-event"];
        if (o.kind === "virtual") classes.push("itempo-virtual");
        if (cancelled) classes.push("itempo-cancelled");
        if (done && paid) classes.push("itempo-paid");
        if (done && !paid) classes.push("itempo-unpaid");
        return {
          id: o.materialized?.id ?? `virtual:${o.recurringRuleId}:${o.originalStart}`,
          title: `${o.client?.name ?? "?"} · ${o.service?.name ?? ""}`,
          start: o.startAt,
          end: o.endAt,
          backgroundColor: bg,
          borderColor: bg,
          textColor: "#fff",
          classNames: classes,
          extendedProps: {
            occurrence: o,
          },
        };
      }),
    [occurrences],
  );

  const onDatesSet = (info: { start: Date; end: Date }) => {
    setRange({ from: info.start, to: info.end });
  };

  const onDateSelect = (info: { start: Date; end: Date; allDay: boolean; jsEvent: Event | null }) => {
    if (clients.length === 0) {
      toast.error(t("noClients"));
      return;
    }
    if (services.length === 0) {
      toast.error(t("noServices"));
      return;
    }
    setDialog({
      mode: "create",
      defaultStart: info.start,
      defaultEnd: info.end,
    });
  };

  const onEventClick = (arg: { event: { extendedProps: { occurrence: (typeof occurrences)[number] } } }) => {
    const occ = arg.event.extendedProps.occurrence;
    setDialog({ mode: "edit", occurrence: occ });
  };

  const onEventChange = async (arg: {
    event: { start: Date; end: Date | null; extendedProps: { occurrence: (typeof occurrences)[number] } };
    revert: () => void;
  }) => {
    const occ = arg.event.extendedProps.occurrence;
    const newStart = arg.event.start;
    const newEnd = arg.event.end ?? new Date(newStart.getTime() + 60 * 60_000);
    try {
      await moveOccurrence({
        appointmentId: occ.materialized?.id ?? null,
        ruleId: occ.recurringRuleId || null,
        originalStart: occ.originalStart,
        newStart: newStart.toISOString(),
        newEnd: newEnd.toISOString(),
      });
      toast.success("✓");
      if (range) refresh(range.from, range.to);
    } catch {
      arg.revert();
      toast.error("Error");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-3xl font-medium tracking-tight">{t("title")}</h1>
        <Button
          size="sm"
          onClick={() => {
            if (clients.length === 0) return toast.error(t("noClients"));
            if (services.length === 0) return toast.error(t("noServices"));
            const d = new Date();
            d.setMinutes(0, 0, 0);
            d.setHours(d.getHours() + 1);
            setDialog({ mode: "create", defaultStart: d, defaultEnd: new Date(d.getTime() + 60 * 60_000) });
          }}
        >
          <Plus className="h-4 w-4" />
          {t("newAppointment")}
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-2 sm:p-4">
        <CalendarClientMount
          ref={mountRef}
          events={events}
          locale={locale}
          onDatesSet={onDatesSet}
          onDateSelect={onDateSelect}
          onEventClick={onEventClick}
          onEventChange={onEventChange}
        />
      </div>

      {dialog && (
        <AppointmentDialog
          key={dialog.mode === "edit" ? dialog.occurrence.originalStart : dialog.defaultStart.toISOString()}
          input={dialog}
          clients={clients}
          services={services}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            if (range) refresh(range.from, range.to);
          }}
        />
      )}
    </div>
  );
}

function CalendarSkeleton() {
  return <div className="h-[600px] animate-pulse rounded-lg bg-muted/40" />;
}
